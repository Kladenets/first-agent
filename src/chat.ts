import { DEFAULT_GEMINI_MODEL, GeminiAgent } from "./gemini-agent.ts";
import { ActivityTool, WeatherTool } from "./tools.ts";

/**
 * Interactive chat session.
 *
 * Run:  bun run chat
 *
 * Each turn goes through Agent.run(), so the Conversation accumulates and
 * later questions have context from earlier ones.
 */

const MODEL = process.env["GEMINI_MODEL"] ?? DEFAULT_GEMINI_MODEL;

const agent = new GeminiAgent({
  model: MODEL,
  tools: [new WeatherTool(), new ActivityTool()],
});

console.log(`Model: ${MODEL}`);
console.log("Tools: get_weather, get_activity");
console.log("Commands: /history, /exit  (or Ctrl+C)\n");

process.stdout.write("you> ");

for await (const line of console) {
  const input = line.trim();

  if (input.length === 0) {
    process.stdout.write("you> ");
    continue;
  }

  if (input === "/exit") {
    break;
  }

  if (input === "/history") {
    const history = agent.getConversation().toString();
    console.log(history.length > 0 ? `\n${history}\n` : "\n(empty)\n");
    process.stdout.write("you> ");
    continue;
  }

  try {
    const reply = await agent.run(input);
    console.log(`\ngemini> ${reply.trim()}\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nerror> ${message}\n`);
  }

  process.stdout.write("you> ");
}

console.log("\nbye");
