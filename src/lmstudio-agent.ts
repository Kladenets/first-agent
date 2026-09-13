import { type LLM, LMStudioClient } from "@lmstudio/sdk";
import type { Agent, AgentConfig } from "./agent.ts";

/**
 * An {@link Agent} backed by a locally running LM Studio server.
 *
 * This agent never loads a model. It only uses models already loaded in
 * LM Studio, and throws if none are loaded.
 */
export class LMStudioAgent implements Agent {
  readonly #client: LMStudioClient;
  readonly #model: string;

  constructor(config: AgentConfig) {
    this.#client = new LMStudioClient();
    this.#model = config.model;
  }

  async run(prompt: string): Promise<string> {
    const model = await this.#resolveLoadedModel();
    const result = await model.respond(prompt);
    return result.content;
  }

  async *stream(prompt: string): AsyncGenerator<string> {
    const model = await this.#resolveLoadedModel();

    for await (const fragment of model.respond(prompt)) {
      yield fragment.content;
    }
  }

  /**
   * Resolve an already-loaded model, preferring the configured one.
   * Falls back to the first loaded model so a stale key never forces a load.
   */
  async #resolveLoadedModel(): Promise<LLM> {
    const loaded = await this.#client.llm.listLoaded();

    const first = loaded[0];
    if (first === undefined) {
      throw new Error(
        "No model is currently loaded in LM Studio. Load one in the LM Studio UI, then retry.",
      );
    }

    const match = loaded.find(
      (llm) => llm.identifier === this.#model || llm.modelKey === this.#model,
    );

    return match ?? first;
  }
}
