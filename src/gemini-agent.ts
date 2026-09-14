import { GoogleGenAI } from "@google/genai";
import type { Agent, AgentConfig } from "./agent.ts";
import { Conversation } from "./conversation.ts";
import type { Tool } from "./tools.ts";

/**
 * Default model. Free-of-charge on the Gemini free tier.
 *
 * Google's quickstart shows `gemini-3.8-flash`, but that is a paid model and
 * fails with a 429 spend-cap error on free-tier projects.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

/** Safety valve so a misbehaving model cannot loop on tool calls forever. */
const MAX_TOOL_TURNS = 5;

/** One tool call requested by the model. */
type ToolCall = {
  readonly id: string;
  readonly name: string;
  readonly arguments: unknown;
};

/** Narrow an interaction step to a `function_call` without losing its type. */
function isFunctionCall<TStep extends { type: string }>(
  step: TStep,
): step is Extract<TStep, { type: "function_call" }> {
  return step.type === "function_call";
}

/**
 * An {@link Agent} backed by the Google Gemini API, using the Interactions
 * API shown in Google's current getting-started docs.
 *
 * Reads the API key from `GEMINI_API_KEY`, falling back to `GOOGLE_API_KEY`.
 * Get a free key at https://aistudio.google.com/apikey
 */
export class GeminiAgent implements Agent {
  readonly #client: GoogleGenAI;
  readonly #model: string;
  readonly #conversation: Conversation;
  readonly #tools: readonly Tool[];

  constructor(config: AgentConfig) {
    const apiKey = process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_API_KEY"];

    if (apiKey === undefined || apiKey.length === 0) {
      throw new Error(
        "No API key found. Set GEMINI_API_KEY (or GOOGLE_API_KEY). " +
          "Create a free key at https://aistudio.google.com/apikey",
      );
    }

    this.#client = new GoogleGenAI({ apiKey });
    this.#model = config.model;
    this.#conversation = new Conversation();
    this.#tools = config.tools ?? [];
  }

  async run(prompt: string): Promise<string> {
    this.#conversation.addMessage("user", prompt);

    const text =
      this.#tools.length === 0 ? await this.#generate() : await this.#generateWithTools();

    this.#conversation.addMessage("assistant", text);

    return text;
  }

  /**
   * Plain text generation. Used when no tools are configured.
   *
   * Note: if the conversation primes the model to call a tool that was never
   * declared, it may improvise one as text and the API can reject the result
   * with a 400. Declaring tools is the fix — that gives the call a structured
   * channel. `tool_choice: "none"` does not help; it only selects among
   * declared tools, and setting it alongside declared tools reintroduces the
   * same failure.
   */
  async #generate(): Promise<string> {
    const interaction = await this.#client.interactions.create({
      model: this.#model,
      input: this.#conversation.toString(),
    });

    return this.#requireText(interaction.output_text);
  }

  /**
   * Tool-calling generation.
   *
   * Sends the tool declarations, and while the model asks for calls, executes
   * them and feeds the results back via `previous_interaction_id` until it
   * settles on a text answer.
   */
  async #generateWithTools(): Promise<string> {
    const tools = this.#toolDeclarations();

    let interaction = await this.#client.interactions.create({
      model: this.#model,
      input: this.#conversation.toString(),
      tools,
    });

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn += 1) {
      const calls = interaction.steps.filter(isFunctionCall);
      if (calls.length === 0) {
        break;
      }

      const results = await Promise.all(calls.map((call) => this.#executeCall(call)));

      interaction = await this.#client.interactions.create({
        model: this.#model,
        previous_interaction_id: interaction.id,
        input: results,
        tools,
      });
    }

    return this.#requireText(interaction.output_text);
  }

  /**
   * Convert our provider-agnostic {@link Tool} list into Gemini function
   * declarations.
   *
   * Note: no Zod. Zod is an LM Studio requirement; Gemini takes plain JSON
   * Schema, which `Tool.parameters` already is, so this is a direct mapping.
   */
  #toolDeclarations(): Array<{
    type: "function";
    name: string;
    description: string;
    parameters: Tool["parameters"];
  }> {
    return this.#tools.map((tool) => ({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Generic dispatch: look the tool up by the name the model asked for, run
   * it, and shape the outcome as a `function_result` step. Works with any
   * {@link Tool} implementation.
   */
  async #executeCall(call: ToolCall): Promise<{
    type: "function_result";
    name: string;
    call_id: string;
    result: string;
    is_error: boolean;
  }> {
    const tool = this.#tools.find((candidate) => candidate.name === call.name);

    if (tool === undefined) {
      return {
        type: "function_result",
        name: call.name,
        call_id: call.id,
        result: `No tool named "${call.name}" is registered.`,
        is_error: true,
      };
    }

    try {
      return {
        type: "function_result",
        name: call.name,
        call_id: call.id,
        result: await tool.execute(call.arguments),
        is_error: false,
      };
    } catch (error: unknown) {
      return {
        type: "function_result",
        name: call.name,
        call_id: call.id,
        result: error instanceof Error ? error.message : String(error),
        is_error: true,
      };
    }
  }

  #requireText(text: string | undefined): string {
    if (text === undefined) {
      throw new Error(`Model "${this.#model}" returned no text.`);
    }
    return text;
  }

  getConversation(): Conversation {
    return this.#conversation;
  }

  /**
   * TODO: stream() does not participate in the conversation history.
   *
   * Unlike run(), this sends the raw `prompt` and records nothing, so
   * streamed turns are invisible to getConversation() and provide no context
   * to later calls. run() is stateful, stream() is not.
   *
   * To fix:
   *   1. addMessage("user", prompt) before the request, and send
   *      `input: this.#conversation.toString()` instead of the raw prompt.
   *   2. Accumulate yielded chunks into a local array.
   *   3. After the loop completes, join them and
   *      addMessage("assistant", joined).
   *
   * Step 3 is the awkward part: a consumer that `break`s early, or an error
   * mid-stream, leaves the turn partially generated. Decide deliberately
   * whether to record the partial text or drop it — a `try/finally` around
   * the loop can record whatever arrived, at the cost of storing truncated
   * replies. Note run() has a milder version of the same issue: it adds the
   * user message before the request, so a failed call leaves an orphaned
   * user message with no assistant reply.
   */
  async *stream(prompt: string): AsyncGenerator<string> {
    const events = await this.#client.interactions.create({
      model: this.#model,
      input: prompt,
      stream: true,
    });

    for await (const event of events) {
      if (event.event_type === "step.delta" && event.delta.type === "text") {
        yield event.delta.text;
      }
    }
  }
}
