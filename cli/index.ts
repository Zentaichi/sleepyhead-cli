import { Command } from 'commander';
import { registerDetectCommand } from './commands/detect.js';
import { registerHardenCommand } from './commands/harden.js';
import { registerVerifyCommand } from './commands/verify.js';
import { registerRollbackCommand } from './commands/rollback.js';
import { registerMigrateCommand } from './commands/migrate.js';

export async function main(argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name('sleepyhead-cli')
    .description('Guided TDE hardening for XAMPP-bundled MariaDB/MySQL installs')
    .version('0.2.0');

  registerDetectCommand(program);
  registerHardenCommand(program);
  registerVerifyCommand(program);
  registerRollbackCommand(program);
  registerMigrateCommand(program);

  await program.parseAsync(argv);
}
