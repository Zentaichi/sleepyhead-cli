import { Command } from 'commander';
import { registerDetectCommand } from './commands/detect.js';
import { registerHardenCommand } from './commands/harden.js';
import { registerVerifyCommand } from './commands/verify.js';
import { registerRollbackCommand } from './commands/rollback.js';
import { registerMigrateCommand } from './commands/migrate.js';
import { printBanner } from './ui/banner.js';

const VERSION = '0.2.0';

export async function main(argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name('sleepyhead')
    .description('Guided TDE hardening for XAMPP-bundled MariaDB/MySQL installs')
    .version(VERSION);

  registerDetectCommand(program);
  registerHardenCommand(program);
  registerVerifyCommand(program);
  registerRollbackCommand(program);
  registerMigrateCommand(program);

  // Don't print the banner in front of --help / --version; those should be clean.
  const wantsHelp = argv.slice(2).some((a) => a === '--help' || a === '-h' || a === '--version' || a === '-V');
  if (!wantsHelp) {
    printBanner({ version: VERSION });
  }

  await program.parseAsync(argv);
}
