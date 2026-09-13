/**
 * 3. The three ways a stream ends: normal completion, `break`, and an error.
 *
 * Note `finally` runs in all three cases — that is how a generator cleans up
 * a socket no matter how iteration stopped.
 *
 * Run:  bun examples/03-stream-endings.ts
 */

type Mode = "normal" | "break" | "error";

async function* gen(mode: Mode): AsyncGenerator<number> {
  try {
    for (const n of [1, 2, 3, 4, 5]) {
      if (mode === "error" && n === 3) {
        throw new Error("stream failed at 3");
      }
      yield n;
    }
    console.log("   [gen] ran to completion");
  } finally {
    console.log("   [gen] cleanup ran");
  }
}

console.log("1) normal end — loop stops on its own, no break:");
for await (const n of gen("normal")) {
  console.log("   got", n);
}

console.log("\n2) break — consumer quits early:");
for await (const n of gen("break")) {
  console.log("   got", n);
  if (n === 2) {
    break;
  }
}

console.log("\n3) error — throws mid-stream, AFTER yielding some values:");
try {
  for await (const n of gen("error")) {
    console.log("   got", n);
  }
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.log("   caught:", message);
}

// Note in case 3 that values 1 and 2 arrived BEFORE the throw.
// That is the partial-output hazard: a stream can give you real data and
// then fail, unlike run() which is all-or-nothing.
