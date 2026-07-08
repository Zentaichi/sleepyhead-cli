import type { Command } from 'commander';
import { comingSoon } from '../ui/messages.js';

export function registerMigrateCommand(program: Command): void {
  program
    .command('migrate-tables')
    .description('Run step 7 (ALTER TABLE ... ENCRYPTION) with row/table count progress reporting')
    .action(async () => {
      // Wired in Milestone 3/4 alongside the real step 7 implementation.
      comingSoon('sleepyhead migrate-tables', 'Milestone 3/4');
    });
}
