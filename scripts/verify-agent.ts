import { LMStudioAgent } from "../src/lmstudio-agent.ts";

/** Minimal no-framework assertion helper. */
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

const MODEL = process.env["LMSTUDIO_MODEL"] ?? "qwen2.5-7b-instruct";

async function main(): Promise<void> {
  console.log(`Preferred model: ${MODEL}`);

  const agent = new LMStudioAgent({ model: MODEL });

  const pending = agent.run("What is 2+2?");
  assert(pending instanceof Promise, "run() should return a Promise");
  console.log("PASS  run() returns a Promise");

  const result = await pending;
  assert(typeof result === "string", `expected a string, got ${typeof result}`);
  console.log("PASS  resolves to a string");

  assert(result.length > 0, "expected a non-empty string");
  console.log("PASS  string is non-empty");

  console.log(`\nResponse: ${result.trim()}`);
  console.log("\nAll assertions passed.");
}

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nFAIL  ${message}`);
  console.error("\nIs LM Studio running, with a model loaded?");
  process.exit(1);
}
