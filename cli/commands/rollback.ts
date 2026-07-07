import type { Command } from 'commander';

export function registerRollbackCommand(program: Command): void {
  program
    .command('rollback')
    .description('Revert to the last known-good backup and config state')
    .action(async () => {
      // Wired in Milestone 5 alongside util/backup.ts.
      console.log('sleepyhead rollback: not yet implemented (Milestone 5)');
    });
}
