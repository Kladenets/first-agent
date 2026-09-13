import { GoogleGenAI } from "@google/genai";
import type { Agent, AgentConfig } from "./agent.ts";
import { Conversation } from "./conversation.ts";

/**
 * Default model. Free-of-charge on the Gemini free tier.
 *
 * Google's quickstart shows `gemini-3.8-flash`, but that is a paid model and
 * fails with a 429 spend-cap error on free-tier projects.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

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
  }

  async run(prompt: string): Promise<string> {
    this.#conversation.addMessage("user", prompt);

    const interaction = await this.#client.interactions.create({
      model: this.#model,
      input: this.#conversation.toString(),
    });

    const text = interaction.output_text;
    if (text === undefined) {
      throw new Error(`Model "${this.#model}" returned no text.`);
    }

    this.#conversation.addMessage("assistant", text);

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
