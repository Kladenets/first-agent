/**
 * 1. Async generator basics: laziness, and the yield/pause rhythm.
 *
 * Run:  bun examples/01-async-generator-basics.ts
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// `async` + `function*` = an async generator.
async function* counter(): AsyncGenerator<number> {
  console.log("  [gen] starting work");

  for (const n of [1, 2, 3]) {
    await sleep(300); // pretend this is a network chunk arriving
    console.log(`  [gen] producing ${n}`);
    yield n; // hand one value to the consumer, then PAUSE here
  }

  console.log("  [gen] done");
}

console.log("1. calling counter() ...");
const items = counter();
console.log("2. called it — notice nothing ran yet\n");

console.log("3. now iterating:");
for await (const n of items) {
  console.log(`     [loop] received ${n}`);
}

console.log("\n4. loop finished");

// Things to try:
//   - Add `break` after the first value. Does "[gen] done" still print?
//   - Move the console.log on line 20 above the `await`. Does the order change?
//   - Call counter() but never iterate it. Confirm nothing runs at all.
