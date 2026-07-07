import type { Command } from 'commander';

export function registerHardenCommand(program: Command): void {
  program
    .command('harden')
    .description('Run the guided TDE hardening flow (steps 1-8)')
    .option('--profile <name>', 'DB profile to use (auto-suggested if omitted)')
    .option('--dry-run', 'show every command/diff that would run, without executing', false)
    .option('--yes', 'skip confirmations (requires a prior successful --dry-run this session)', false)
    .option('--resume', 'resume from the last verified step in an interrupted run', false)
    .action(async (_opts) => {
      // Wired to real steps/adapters/profiles in Milestone 3.
      console.log('sleepyhead-cli harden: not yet implemented (Milestone 3)');
    });
}
