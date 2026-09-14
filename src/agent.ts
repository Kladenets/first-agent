import type { Conversation } from "./conversation.ts";
import type { Tool } from "./tools.ts";

/** Configuration for constructing an {@link Agent}. */
export interface AgentConfig {
  /** The model ID, e.g. `"gemini-3.5-flash-lite"`. */
  readonly model: string;

  /** Tools the model may call. Omit for plain text generation. */
  readonly tools?: Tool[];
}

/** A minimal single-shot text agent. */
export interface Agent {
  /** Send a prompt and resolve with the model's full response text. */
  run(prompt: string): Promise<string>;

  /**
   * Send a prompt and yield response text incrementally.
   *
   * Note this returns an async iterable directly, not a Promise, so it is
   * consumed with `for await` without awaiting the call itself.
   */
  stream(prompt: string): AsyncIterable<string>;

  /** Access the conversation history. */
  getConversation(): Conversation;
}
