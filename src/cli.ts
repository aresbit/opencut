import { Command } from "commander";
import { VERSION } from "./index.ts";

export function buildProgram(): Command {
  const program = new Command();
  program.name("pycut").description("AI-powered video clipping CLI").version(VERSION);
  return program;
}

async function main(argv: string[]): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv);
}

const entry = process.argv[1] ?? "";
const isMain =
  import.meta.url === `file://${entry}` ||
  entry.endsWith("/cli.ts") ||
  entry.endsWith("/cli.js");

if (isMain) {
  main(process.argv).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
