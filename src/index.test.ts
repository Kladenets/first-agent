import { describe, expect, test } from "bun:test";
import { greet } from "./index.ts";

describe("greet", () => {
  test("greets by name", () => {
    expect(greet("Bun")).toBe("Hello, Bun!");
  });
});
