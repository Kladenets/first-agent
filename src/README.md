# `src/`

A minimal agent over the Google Gemini API.

| file                     | role                                                    |
| ------------------------ | ------------------------------------------------------- |
| `agent.ts`               | `Agent` and `AgentConfig` interfaces — the contract      |
| `gemini-agent.ts`        | `GeminiAgent` — the implementation                       |
| `gemini-agent.verify.ts` | no-framework test for `GeminiAgent`                      |

```bash
bun run verify:agent   # runs gemini-agent.verify.ts (needs GEMINI_API_KEY)
bun run check          # typecheck + lint
```

## The contract

```ts
export interface Agent {
  run(prompt: string): Promise<string>;
  stream(prompt: string): AsyncIterable<string>;
}
```

`run` returns the whole answer once. `stream` returns pieces as they arrive.
Same endpoint, different delivery.

```ts
const answer = await agent.run("What is 2+2?");          // await it

for await (const chunk of agent.stream("What is 2+2?")) { // do NOT await it
  process.stdout.write(chunk);
}
```

`stream()` is **not** a Promise. `await agent.stream(...)` is a bug, which is
why `gemini-agent.verify.ts` asserts `stream() does not return a Promise`.

---

## How `stream()` works

`GeminiAgent.stream` is both a consumer and a producer:

```ts
async *stream(prompt: string): AsyncGenerator<string> {
  const events = await this.#client.interactions.create({   // (1)
    model: this.#model,
    input: prompt,
    stream: true,
  });

  for await (const event of events) {                       // (2) inner loop
    if (event.event_type === "step.delta" && event.delta.type === "text") {
      yield event.delta.text;                               // (3)
    }
  }
}
```

and `gemini-agent.verify.ts` consumes it:

```ts
for await (const chunk of stream) {                         // (4) outer loop
  chunks.push(chunk);
}
```

### It is a pull chain

```
(4) outer loop   for await (const chunk of stream)     <- gemini-agent.verify.ts
      pulls
(2) inner loop   for await (const event of events)     <- gemini-agent.ts
      pulls
    the wire     Google's server-sent events
```

Nothing is pushed. The outer loop asks, which makes the inner loop ask, which
pulls an SSE event. Only one loop runs at a time; they take turns.

### One round trip

1. `(4)` calls `stream.next()` under the hood, creating a **pending promise**
2. The generator body runs. On the **first** call it starts at the top and
   awaits `(1)`, opening the connection. On **later** calls it resumes on the
   line just after `(3)` — it never re-enters from the top
3. `(2)` pulls events. Non-text events fail the `if` and are skipped, so the
   loop spins while `(4)` is still waiting
4. A text delta arrives, `(3)` fires, and the pending promise settles with
   that string — it lands in `(4)` as `chunk`
5. The generator freezes at `(3)`; the outer loop body runs
6. When the SSE feed ends, the generator returns, `done` becomes `true`, and
   `(4)` exits

### `(2)` and `(4)` are not in lockstep

The `if` filter drops status updates, thought signatures, and tool calls. A
verified run against `gemini-3.5-flash-lite` produced **2 chunks** from more
than 2 wire events. `chunks.length` counts text deltas, not SSE events.

---

## The promises involved

There are three, and they are easy to conflate:

| # | promise                                        | how many               | settles when                     |
| - | ---------------------------------------------- | ---------------------- | -------------------------------- |
| 1 | `Promise<Stream<InteractionSSEEvent>>` from `(1)`   | one                    | HTTP response headers arrive     |
| 2 | `Promise<IteratorResult<...>>` per event        | one per SSE event      | the next wire event arrives      |
| 3 | `Promise<IteratorResult<string>>` per chunk     | one per yielded chunk  | `(3)` runs                         |

Promise 3 is the one to understand: **it is created by the consumer, not the
producer.** `(4)` calling `next()` makes it. `(3)` only supplies the value that
settles it. `yield` is not the promise's source.

`AsyncGenerator<string>` is therefore *not* `Promise<string[]>`:

```ts
Promise<string[]>       // one promise, resolves once, with everything
AsyncGenerator<string>  // no outer promise; a new promise per step
```

### Why `(1)` needs its own `await`

`interactions.create({ stream: true })` returns a `Promise` that *resolves to*
the stream, so it must be unwrapped before iterating. Dropping the `await`
fails to compile:

```
TS2504: Type 'Promise<Stream<InteractionSSEEvent>>' must have a
'[Symbol.asyncIterator]()' method that returns an async iterator.
```

That promise settles when headers arrive — the body is still streaming. `(1)`
is setup; `(2)` is per-item. They cannot collapse into one promise, because
there is no single moment at which all the data exists.

---

## Failure modes differ

`run()` is all-or-nothing: it rejects, and one `try/catch` around the `await`
covers it. It also throws when `output_text` is `undefined`.

`stream()` can fail **after** yielding real chunks, so the `try` must wrap the
loop. An empty stream is silent — it yields nothing and completes normally.

Three things end a stream: normal completion (`done: true`), `break` from the
consumer, and a throw. See `examples/03-stream-endings.ts`.

---

## Models

`DEFAULT_GEMINI_MODEL` is `gemini-3.5-flash-lite` — free-of-charge on the
Gemini free tier. Google's quickstart shows `gemini-3.8-flash`, but that is a
paid model and returns `429` on a free-tier project. Override with the
`GEMINI_MODEL` env var.

The API key is read from `GEMINI_API_KEY`, falling back to `GOOGLE_API_KEY`.
Put it in `.env` (already gitignored); Bun loads it automatically.

## See also

`examples/` has runnable standalone demos of the async-generator mechanics
described above. They need no API key.
