import { DEFAULT_GEMINI_MODEL, GeminiAgent } from "./gemini-agent.ts";

/** Minimal no-framework assertion helper. */
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

const MODEL = process.env["GEMINI_MODEL"] ?? DEFAULT_GEMINI_MODEL;

async function main(): Promise<void> {
  console.log(`Model: ${MODEL}\n`);

  const agent = new GeminiAgent({ model: MODEL });

  // --- 1. run(): Promise<string> ---
  const pending = agent.run("What is 2+2?");
  assert(pending instanceof Promise, "run() should return a Promise");
  console.log("PASS  run() returns a Promise");

  const result1 = await pending;
  assert(typeof result1 === "string", `run() should resolve to a string, got ${typeof result1}`);
  console.log("PASS  run() resolves to a string");

  // --- 2. one exchange == 2 messages ---
  const afterFirst = agent.getConversation().getMessages();
  assert(afterFirst.length === 2, `expected 2 messages, got ${afterFirst.length}`);
  console.log("PASS  conversation has 2 messages after first call");

  // --- 3. second exchange == 4 messages ---
  const result2 = await agent.run("What about 3+3?");
  assert(typeof result2 === "string", "second run() should resolve to a string");

  const afterSecond = agent.getConversation().getMessages();
  assert(afterSecond.length === 4, `expected 4 messages, got ${afterSecond.length}`);
  console.log("PASS  conversation has 4 messages after second call");

  // --- 4. roles alternate user/assistant ---
  const roles = afterSecond.map((message) => message.role);
  const expectedRoles = ["user", "assistant", "user", "assistant"];
  assert(
    roles.length === expectedRoles.length && roles.every((r, i) => r === expectedRoles[i]),
    `expected roles ${expectedRoles.join(",")}, got ${roles.join(",")}`,
  );
  console.log("PASS  roles are user/assistant/user/assistant");

  // --- 5. toString() formatting ---
  const text = agent.getConversation().toString();
  assert(typeof text === "string", "toString() should return a string");

  const lines = text.split("\n");
  assert(lines.length >= 4, `expected at least 4 lines, got ${lines.length}`);

  const firstLine = lines[0];
  assert(firstLine?.startsWith("user: ") === true, "line 1 should start 'user: '");
  assert(
    firstLine === `user: ${afterSecond[0]?.content ?? ""}`,
    "line 1 should be 'role: content' for the first message",
  );
  console.log("PASS  toString() is formatted as 'role: content' lines");

  // --- stream(): AsyncIterable<string> ---
  const stream = agent.stream("Say hi");
  assert(!(stream instanceof Promise), "stream() should not return a Promise");
  assert(
    typeof stream[Symbol.asyncIterator] === "function",
    "stream() should return an AsyncIterable",
  );

  const chunks: string[] = [];
  for await (const chunk of stream) {
    assert(typeof chunk === "string", `each chunk should be a string, got ${typeof chunk}`);
    chunks.push(chunk);
  }
  console.log(`PASS  stream() yields only strings (${chunks.length} chunk(s))`);

  // Informational only. The model is nondeterministic, so the text itself
  // is never asserted on.
  console.log(`\n--- run() #1 (not asserted) ---\n${result1.trim()}`);
  console.log(`\n--- run() #2, should have context (not asserted) ---\n${result2.trim()}`);
  console.log(`\n--- conversation.toString() (not asserted) ---\n${text}`);
  console.log("\nAll assertions passed.");
}

try {
  await main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nFAIL  ${message}`);
  process.exit(1);
}
