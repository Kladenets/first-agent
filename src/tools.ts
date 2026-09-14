/**
 * A provider-agnostic tool an LLM can call.
 *
 * Note: the `properties` and `execute(params)` types are `unknown` rather
 * than `any`, because this project bans explicit `any` (Biome
 * `noExplicitAny`). `unknown` is the type-safe equivalent — it accepts any
 * value but forces callers to narrow before use.
 */
export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute(params: unknown): Promise<string>;
}

/** Returns the current weather. Takes no parameters. */
export class WeatherTool implements Tool {
  readonly name = "get_weather";
  readonly description = "Get current weather conditions";
  readonly parameters: Tool["parameters"] = {
    type: "object",
    properties: {},
  };

  execute(_params: unknown): Promise<string> {
    // 0 = Sunday ... 6 = Saturday. Mon-Thu are sunny; Fri, Sat, Sun are rainy.
    const day = new Date().getDay();
    const isSunny = day >= 1 && day <= 4;
    return Promise.resolve(isSunny ? "sunny" : "rainy");
  }
}

/** Suggests activities for a given weather condition. */
export class ActivityTool implements Tool {
  readonly name = "get_activity";
  readonly description = "Get activity suggestions based on weather";
  readonly parameters: Tool["parameters"] = {
    type: "object",
    properties: {
      weather: {
        type: "string",
        description: "The weather condition (sunny or rainy)",
      },
    },
    required: ["weather"],
  };

  readonly #activities: Record<string, string[]> = {
    sunny: ["hiking", "beach volleyball", "picnic", "outdoor concert"],
    rainy: ["movie theater", "museum", "cozy cafe", "bookstore"],
  };

  execute(params: unknown): Promise<string> {
    const weather = this.#readWeather(params);
    const activities = this.#activities[weather] ?? [];
    return Promise.resolve(JSON.stringify(activities));
  }

  /** Narrow the untyped params down to the `weather` string. */
  #readWeather(params: unknown): string {
    if (typeof params !== "object" || params === null || !("weather" in params)) {
      throw new Error('get_activity requires a "weather" parameter.');
    }

    const { weather } = params;
    if (typeof weather !== "string") {
      throw new Error(`get_activity "weather" must be a string, got ${typeof weather}.`);
    }

    return weather;
  }
}
