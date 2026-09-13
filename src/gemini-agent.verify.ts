import { DEFAULT_GEMINI_MODEL, GeminiAgent } from "./gemini-agent.ts";

/** Minimal no-framework assertion helper. */
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

const MODEL = process.env["GEMINI_MODEL"] ?? DEFAULT_GEMINI_MODEL;
const PROMPT = "What is 2+2?";

async function main(): Promise<void> {
  console.log(`Model: ${MODEL}\n`);

  const agent = new GeminiAgent({ model: MODEL });

  // --- run(): Promise<string> ---
  const pending = agent.run(PROMPT);
  assert(pending instanceof Promise, "run() should return a Promise");
  console.log("PASS  run() returns a Promise");

  const result = await pending;
  assert(typeof result === "string", `run() should resolve to a string, got ${typeof result}`);
  console.log("PASS  run() resolves to a string");

  // --- stream(): AsyncIterable<string> ---
  // Note: stream() is NOT a Promise. The SDK's generateContentStream resolves
  // to an async generator, but we expose the iterable directly, so it is
  // consumed with `for await` and never awaited itself.
  const stream = agent.stream(PROMPT);
  assert(!(stream instanceof Promise), "stream() should not return a Promise");
  console.log("PASS  stream() does not return a Promise");

  assert(
    typeof stream[Symbol.asyncIterator] === "function",
    "stream() should return an AsyncIterable",
  );
  console.log("PASS  stream() returns an AsyncIterable");

  const chunks: string[] = [];
  for await (const chunk of stream) {
    assert(typeof chunk === "string", `each chunk should be a string, got ${typeof chunk}`);
    chunks.push(chunk);
  }
  console.log(`PASS  stream() yields only strings (${chunks.length} chunk(s))`);

  // Informational only. The model is nondeterministic, so the text itself
  // is never asserted on.
  console.log(`\n--- run() response (not asserted) ---\n${result.trim()}`);
  console.log(`\n--- stream() response (not asserted) ---\n${chunks.join("").trim()}`);
  console.log("\nAll assertions passed.");
}

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nFAIL  ${message}`);
  process.exit(1);
}
