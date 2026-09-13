/** Configuration for constructing an {@link Agent}. */
export interface AgentConfig {
  /** The LM Studio model key, e.g. `"qwen2.5-7b-instruct"`. */
  readonly model: string;
}

/** A minimal single-shot text agent. */
export interface Agent {
  /** Send a prompt and resolve with the model's response text. */
  run(prompt: string): Promise<string>;
}
