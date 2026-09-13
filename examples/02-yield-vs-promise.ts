/**
 * 2. `yield` and Promises are independent.
 *
 * Every line of output below is probed at runtime, not hardcoded.
 *
 * Run:  bun examples/02-yield-vs-promise.ts
 */

/** Inspect what a value actually is, at runtime. */
function kindOf(value: unknown): string {
  if (value instanceof Promise) {
    return "Promise";
  }
  if (typeof value === "object" && value !== null) {
    if (Symbol.asyncIterator in value) {
      return "AsyncIterable";
    }
    if (Symbol.iterator in value) {
      return "Iterable";
    }
  }
  return typeof value;
}

function describe(label: string, value: unknown): void {
  console.log(`${label.padEnd(34)} -> ${kindOf(value)}`);
}

// 1. one value, now
function one(): number {
  return 1;
}

// 2. many values, now      (yield, NO promise)
function* manyNow(): Generator<number> {
  yield 1;
  yield 2;
}

// 3. one value, later      (promise, NO yield)
async function oneLater(): Promise<number> {
  return 1;
}

// 4. many values, later    (yield AND promise)
async function* manyLater(): AsyncGenerator<number> {
  yield 1;
  yield 2;
}

console.log("what each call actually returns:\n");
describe("one()          return", one());
describe("manyNow()      function*", manyNow());
describe("oneLater()     async", oneLater());
describe("manyLater()    async function*", manyLater());

console.log("\nhow you consume each:\n");
console.log("one()      =", one());
console.log("oneLater() =", await oneLater());

const fromSync: number[] = [];
for (const n of manyNow()) {
  fromSync.push(n);
}
console.log("manyNow()  =", fromSync, "(for...of)");

const fromAsync: number[] = [];
for await (const n of manyLater()) {
  fromAsync.push(n);
}
console.log("manyLater()=", fromAsync, "(for await...of)");

// The point:
//   manyNow()   uses yield but is NOT a Promise  -> yield != async
//   oneLater()  is a Promise but uses NO yield   -> async != yield
//   manyLater() needs both, and is the shape our Agent.stream() returns.
