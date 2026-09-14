import { DEFAULT_GEMINI_MODEL, GeminiAgent } from "./gemini-agent.ts";
import { ActivityTool, type Tool, WeatherTool } from "./tools.ts";

/** Minimal no-framework assertion helper. */
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

const MODEL = process.env["GEMINI_MODEL"] ?? DEFAULT_GEMINI_MODEL;

/** Wraps any tool so we can observe whether the agent really invoked it. */
class SpyTool implements Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: Tool["parameters"];
  calls: unknown[] = [];

  readonly #inner: Tool;

  constructor(inner: Tool) {
    this.#inner = inner;
    this.name = inner.name;
    this.description = inner.description;
    this.parameters = inner.parameters;
  }

  execute(params: unknown): Promise<string> {
    this.calls.push(params);
    return this.#inner.execute(params);
  }
}

async function main(): Promise<void> {
  console.log(`Model: ${MODEL}\n`);

  // --- no tools: existing behaviour is unchanged ---
  const plain = new GeminiAgent({ model: MODEL });
  const plainResult = await plain.run("What is 2+2?");
  assert(typeof plainResult === "string", "no-tools run() should resolve to a string");
  console.log("PASS  no tools -> plain text generation still works");

  // --- with tools ---
  const weather = new SpyTool(new WeatherTool());
  const activity = new SpyTool(new ActivityTool());

  const agent = new GeminiAgent({ model: MODEL, tools: [weather, activity] });

  const result = await agent.run(
    "Use your tools to check the weather, then suggest an activity for it.",
  );
  assert(typeof result === "string", "tool run() should resolve to a string");
  console.log("PASS  tool-enabled run() resolves to a string");

  assert(weather.calls.length > 0, "get_weather should have been executed");
  console.log(`PASS  get_weather executed (${weather.calls.length}x)`);

  assert(activity.calls.length > 0, "get_activity should have been executed");
  console.log(`PASS  get_activity executed (${activity.calls.length}x)`);

  const activityArgs = activity.calls[0];
  assert(
    typeof activityArgs === "object" && activityArgs !== null && "weather" in activityArgs,
    "get_activity should receive a weather argument from the model",
  );
  console.log(`PASS  get_activity received args: ${JSON.stringify(activityArgs)}`);

  const messages = agent.getConversation().getMessages();
  assert(messages.length === 2, `expected 2 messages, got ${messages.length}`);
  console.log("PASS  conversation recorded the exchange");

  console.log(`\n--- final answer (not asserted) ---\n${result.trim()}`);
  console.log("\nAll assertions passed.");
}

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nFAIL  ${message}`);
  process.exit(1);
}
