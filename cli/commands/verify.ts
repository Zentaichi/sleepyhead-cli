import type { Command } from 'commander';
import { comingSoon } from '../ui/messages.js';

export function registerVerifyCommand(program: Command): void {
  program
    .command('verify')
    .description('Re-run verification queries for the current hardening state without mutating anything')
    .action(async () => {
      // Wired in Milestone 4 once adapters have real verify() queries.
      comingSoon('sleepyhead verify', 'Milestone 4');
    });
}
