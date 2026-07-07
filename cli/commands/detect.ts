import type { Command } from 'commander';

export function registerDetectCommand(program: Command): void {
  program
    .command('detect')
    .description('Detect XAMPP install path, MariaDB version, service name/status, and existing key material')
    .action(async () => {
      // Wired to EnvironmentDetector in Milestone 2. Read-only, no mutation.
      console.log('sleepyhead-cli detect: not yet implemented (Milestone 2)');
    });
}
