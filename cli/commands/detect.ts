import type { Command } from 'commander';
import ora from 'ora';
import {
  EnvironmentDetector,
  type DetectionResult,
  type ServiceStatus,
  type XamppDetectionMethod,
} from '../../adapters/EnvironmentDetector.js';
import {
  section,
  kv,
  badge,
  box,
  ynBadge,
  type BadgeKind,
} from '../ui/box.js';
import { renderStepList, renderProgress, type StepView } from '../ui/stepRenderer.js';
import { c, palette, glyph } from '../ui/theme.js';

const HARDENING_PLAN: StepView[] = [
  { id: 'detect-env', description: 'Detect environment', status: 'verified' },
  { id: 'harden-accounts', description: 'Harden DB accounts', status: 'pending', destructive: true },
  { id: 'locate-plugin', description: 'Locate file-key-management plugin', status: 'pending' },
  { id: 'generate-keys', description: 'Generate encryption keys', status: 'pending', destructive: true },
  { id: 'write-config', description: 'Write my.ini config', status: 'pending' },
  { id: 'soft-launch', description: 'Soft-launch verify', status: 'pending' },
  { id: 'migrate-tables', description: 'Migrate tables to encryption', status: 'pending', destructive: true },
  { id: 'cleanup', description: 'Remove plaintext key material', status: 'pending', destructive: true },
];

export function registerDetectCommand(program: Command): void {
  program
    .command('detect')
    .description('Detect XAMPP install path, MariaDB version, service/process status, and existing key material')
    .action(async () => {
      const detector = new EnvironmentDetector();
      const spinner = ora({ text: c.muted('Scanning environment...'), color: 'cyan' }).start();

      let result: DetectionResult;
      try {
        result = await detector.detect();
      } catch (err) {
        spinner.fail(c.danger(`${glyph.cross} Environment scan failed`));
        console.error(err);
        process.exitCode = 1;
        return;
      }

      if (result.xampp.root) {
        spinner.succeed(c.success(`${glyph.check} Environment scan complete`));
      } else {
        spinner.warn(c.warn(`${glyph.warn} Scan complete — no XAMPP install found`));
      }

      printDetectionResult(result);
    });
}

function serviceBadge(status: ServiceStatus): string {
  const map: Record<ServiceStatus, { kind: BadgeKind; label: string }> = {
    running: { kind: 'ok', label: 'running' },
    stopped: { kind: 'warn', label: 'stopped' },
    'not-found': { kind: 'neutral', label: 'not found' },
    unknown: { kind: 'neutral', label: 'unknown' },
  };
  const { kind, label } = map[status];
  return badge(label, kind);
}

function value(text: string | null): string {
  return text ? c.ink(text) : c.faint('not found');
}

function methodLabel(method: XamppDetectionMethod): string {
  const labels: Record<XamppDetectionMethod, string> = {
    'env-override': 'XAMPP_HOME override',
    'known-candidate': 'known install path',
    registry: 'Windows registry (Installed Apps)',
    'running-process': 'running mysqld.exe process',
    'not-found': 'n/a',
  };
  return labels[method];
}

function printDetectionResult(result: DetectionResult): void {
  const isRunning = result.service.status === 'running' || result.process.running;

  console.log();
  console.log(section('XAMPP install'));
  console.log(kv('root', value(result.xampp.root)));
  console.log(kv('my.ini', value(result.xampp.myIniPath)));
  console.log(kv('mysqld.exe', value(result.xampp.mysqldPath)));
  if (result.xampp.root) {
    console.log(kv('found via', c.muted(methodLabel(result.xamppDetectionMethod))));
  }

  console.log();
  console.log(section('MariaDB'));
  console.log(kv('version', value(result.mariadbVersion)));
  console.log(kv('running', ynBadge(isRunning)));

  console.log();
  console.log(section('Windows service'));
  console.log(kv('name', value(result.service.name)));
  console.log(kv('status', serviceBadge(result.service.status)));

  console.log();
  console.log(section('Process'));
  // XAMPP commonly runs mysqld.exe as a bare process via the Control Panel,
  // with no Windows service ever installed — this can be true even when the
  // section above shows "not-found".
  console.log(kv('mysqld.exe', result.process.running ? c.success('running') : c.faint('not running')));
  if (result.process.running) {
    console.log(kv('pid', value(result.process.pid?.toString() ?? null)));
    console.log(kv('path', value(result.process.path)));
  }

  console.log();
  console.log(section('Key material'));
  const keyNote = result.secureKeys.exists ? c.warn('exists') : c.faint('not found');
  console.log(kv('SecureKeys', `${c.ink(result.secureKeys.path)} ${keyNote}`));

  console.log();
  if (!result.xampp.root) {
    console.log(
      c.danger(`${glyph.warn} No XAMPP install found via known paths, the registry, or a running process.`),
    );
    console.log(c.danger(`Set ${c.bold('XAMPP_HOME')} to point directly at your install root.`));
    console.log();
    return;
  }

  console.log(section('Guided hardening plan'));
  console.log(renderStepList(HARDENING_PLAN));
  console.log();
  console.log(box({
    title: `${glyph.moon} progress`,
    accent: palette.violet,
    lines: [renderProgress(1, HARDENING_PLAN.length), '', c.muted('run ') + c.sky('sleepyhead harden') + c.muted(' to begin')],
  }));
  console.log();
}
