# Examples

Runnable scratchpads for the async concepts used by `Agent.stream()`.
Nothing here is imported by `src/` — they exist purely to be edited and re-run.

## Running

```bash
bun examples/01-async-generator-basics.ts
bun examples/02-yield-vs-promise.ts
bun examples/03-stream-endings.ts
```

No API key, no network, no LM Studio required. Bun runs TypeScript directly,
so there is no build step — edit a file and re-run it.

## The files

### `01-async-generator-basics.ts`

Two things that surprise people about async generators:

- Calling one runs **nothing**. The body is frozen until you iterate.
- `yield` **pauses** the function mid-execution and resumes it when the
  consumer asks for the next value.

Watch the `[gen]` and `[loop]` lines interleave — they take turns.

This is why `agent.stream("hi")` sends no HTTP request until a `for await`
starts pulling from it.

### `02-yield-vs-promise.ts`

`yield` and Promises are independent ideas:

|                     | one value          | many values               |
| ------------------- | ------------------ | ------------------------- |
| **available now**   | `return`           | `function*` + `yield`     |
| **available later** | `async` + `await`  | `async function*` + both  |

All four are called and probed at runtime, so the output is measured rather
than asserted:

```
one()          return              -> number
manyNow()      function*           -> Iterable
oneLater()     async               -> Promise
manyLater()    async function*     -> AsyncIterable
```

`manyLater()` is the shape `Agent.stream()` returns.

### `03-stream-endings.ts`

A stream can end three ways, and `finally` runs in all of them:

| exit       | what happens                                        |
| ---------- | --------------------------------------------------- |
| **normal** | generator returns, loop ends by itself — no `break`  |
| **break**  | consumer quits early, generator's `.return()` fires  |
| **error**  | throws, propagates out of `for await`, catchable     |

Case 3 shows the partial-output hazard: values `1` and `2` arrive *before*
the throw. `stream()` can hand you real data and then fail, unlike `run()`
which is all-or-nothing.

## Where this shows up in `src/`

`src/gemini-agent.ts` is both a consumer and a producer of streams:

```ts
async *stream(prompt: string): AsyncGenerator<string> {
  const events = await this.#client.interactions.create({ ..., stream: true });

  for await (const event of events) {        // consuming Google's SSE stream
    if (event.event_type === "step.delta" && event.delta.type === "text") {
      yield event.delta.text;                // producing for your loop
    }
  }
}
```

The `await` on the first line is required: `create({ stream: true })` returns
a `Promise` that *resolves to* the stream. Remove it and `tsc` fails with
`TS2504`.

## Note

These are covered by `bun run check` (typecheck + lint), so they stay honest
as the project changes. If you paste something in that does not compile,
`check` will fail.
