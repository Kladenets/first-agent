import { GoogleGenAI } from "@google/genai";
import type { Agent, AgentConfig } from "./agent.ts";

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
  }

  async run(prompt: string): Promise<string> {
    const interaction = await this.#client.interactions.create({
      model: this.#model,
      input: prompt,
    });

    const text = interaction.output_text;
    if (text === undefined) {
      throw new Error(`Model "${this.#model}" returned no text.`);
    }

    return text;
  }

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
