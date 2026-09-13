import { LMStudioClient } from "@lmstudio/sdk";

const client = new LMStudioClient();
const loaded = await client.llm.listLoaded();

if (loaded.length === 0) {
  console.log("No models are currently loaded in LM Studio.");
} else {
  console.log(`${loaded.length} model(s) loaded:\n`);
  for (const llm of loaded) {
    console.log(`  identifier : ${llm.identifier}`);
    console.log(`  modelKey   : ${llm.modelKey}`);
    console.log(`  displayName: ${llm.displayName}`);
    console.log("");
  }
  console.log("Use either identifier or modelKey as AgentConfig.model");
}

process.exit(0);
