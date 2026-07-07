import type { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import {
  EnvironmentDetector,
  type DetectionResult,
  type ServiceStatus,
  type XamppDetectionMethod,
} from '../../adapters/EnvironmentDetector.js';

export function registerDetectCommand(program: Command): void {
  program
    .command('detect')
    .description('Detect XAMPP install path, MariaDB version, service/process status, and existing key material')
    .action(async () => {
      const detector = new EnvironmentDetector();
      const spinner = ora('Scanning environment...').start();

      let result: DetectionResult;
      try {
        result = await detector.detect();
      } catch (err) {
        spinner.fail('Environment scan failed');
        console.error(err);
        process.exitCode = 1;
        return;
      }

      if (result.xampp.root) {
        spinner.succeed('Environment scan complete');
      } else {
        spinner.warn('Environment scan complete — no XAMPP install found');
      }

      printDetectionResult(result);
    });
}

function printDetectionResult(result: DetectionResult): void {
  const isRunning = result.service.status === 'running' || result.process.running;

  console.log();
  console.log(chalk.bold('XAMPP install'));
  console.log(`  Root:        ${formatValue(result.xampp.root)}`);
  console.log(`  my.ini:      ${formatValue(result.xampp.myIniPath)}`);
  console.log(`  mysqld.exe:  ${formatValue(result.xampp.mysqldPath)}`);
  if (result.xampp.root) {
    console.log(`  Found via:   ${formatDetectionMethod(result.xamppDetectionMethod)}`);
  }

  console.log();
  console.log(chalk.bold('MariaDB'));
  console.log(`  Version:     ${formatValue(result.mariadbVersion)}`);
  console.log(`  Running:     ${isRunning ? chalk.green('yes') : chalk.gray('no')}`);

  console.log();
  console.log(chalk.bold('Windows service'));
  console.log(`  Name:        ${formatValue(result.service.name)}`);
  console.log(`  Status:      ${formatServiceStatus(result.service.status)}`);

  console.log();
  console.log(chalk.bold('Process'));
  // XAMPP commonly runs mysqld.exe as a bare process via the Control Panel,
  // with no Windows service ever installed — this can be true even when the
  // section above shows "not-found".
  console.log(`  mysqld.exe:  ${result.process.running ? chalk.green('running') : chalk.gray('not running')}`);
  if (result.process.running) {
    console.log(`  PID:         ${formatValue(result.process.pid?.toString() ?? null)}`);
    console.log(`  Path:        ${formatValue(result.process.path)}`);
  }

  console.log();
  console.log(chalk.bold('Key material'));
  const keyNote = result.secureKeys.exists ? chalk.yellow('(exists)') : chalk.gray('(not found)');
  console.log(`  SecureKeys:  ${result.secureKeys.path} ${keyNote}`);
  console.log();

  if (!result.xampp.root) {
    console.log(chalk.red('No XAMPP install found via known paths, the registry, or a running process.'));
    console.log(chalk.red('Set XAMPP_HOME to point directly at your install root.'));
    console.log();
  }
}

function formatValue(value: string | null): string {
  return value ?? chalk.gray('not found');
}

function formatServiceStatus(status: ServiceStatus): string {
  switch (status) {
    case 'running':
      return chalk.green(status);
    case 'stopped':
      return chalk.yellow(status);
    case 'not-found':
    case 'unknown':
      return chalk.gray(status);
  }
}

function formatDetectionMethod(method: XamppDetectionMethod): string {
  switch (method) {
    case 'env-override':
      return 'XAMPP_HOME override';
    case 'known-candidate':
      return 'known install path';
    case 'registry':
      return 'Windows registry (Installed Apps)';
    case 'running-process':
      return 'running mysqld.exe process';
    case 'not-found':
      return chalk.gray('n/a');
  }
}
