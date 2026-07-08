import type { Command } from 'commander';
import { comingSoon } from '../ui/messages.js';

export function registerRollbackCommand(program: Command): void {
  program
    .command('rollback')
    .description('Revert to the last known-good backup and config state')
    .action(async () => {
      // Wired in Milestone 5 alongside util/backup.ts.
      comingSoon('sleepyhead rollback', 'Milestone 5');
    });
}
