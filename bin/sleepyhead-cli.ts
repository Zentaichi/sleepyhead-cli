#!/usr/bin/env node
import { main } from '../cli/index.js';
import { printError } from '../cli/ui/messages.js';

main(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  printError('Unexpected failure', message);
  process.exitCode = 1;
});
