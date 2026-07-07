import type { Command } from 'commander';

export function registerVerifyCommand(program: Command): void {
  program
    .command('verify')
    .description('Re-run verification queries for the current hardening state without mutating anything')
    .action(async () => {
      // Wired in Milestone 4 once adapters have real verify() queries.
      console.log('sleepyhead-cli verify: not yet implemented (Milestone 4)');
    });
}
