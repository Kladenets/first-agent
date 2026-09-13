/** A single message in a {@link Conversation}. */
export type Message = {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
};

/** Manages an ordered history of messages. */
export class Conversation {
  readonly #messages: Message[] = [];

  /** Append a message to the history. */
  addMessage(role: Message["role"], content: string): void {
    this.#messages.push({ role, content });
  }

  /** Return the message history. */
  getMessages(): Message[] {
    return this.#messages;
  }

  /** Render the history as `"role: content"` lines joined by newlines. */
  toString(): string {
    return this.#messages.map((message) => `${message.role}: ${message.content}`).join("\n");
  }
}
