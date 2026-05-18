import { Command } from "commander";
import { VERSION } from "./index.js";

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("pycut")
    .description("AI-powered video clipping CLI")
    .version(VERSION);
  return program;
}

async function main(argv: string[]): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv);
}

const invokedDirectly =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("/cli.js") === true;

if (invokedDirectly) {
  main(process.argv).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
