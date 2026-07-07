import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { DetectEnvironmentStep } from '../../steps/00-detect-environment.js';
import { createLogger } from '../../engine/Logger.js';
import type { StepContext } from '../../engine/Step.js';
import type { EnvironmentDetector, DetectionResult } from '../../adapters/EnvironmentDetector.js';

const TEST_LOG_DIR = './.test-logs';

function makeContext(): StepContext {
  return { dryRun: false, profile: {}, logger: createLogger('test-run', TEST_LOG_DIR) };
}

function fakeDetector(result: DetectionResult): EnvironmentDetector {
  return { detect: async () => result } as unknown as EnvironmentDetector;
}

describe('DetectEnvironmentStep', () => {
  afterEach(async () => {
    await fs.rm(TEST_LOG_DIR, { recursive: true, force: true });
  });

  it('succeeds and attaches detection data when a XAMPP root is found', async () => {
    const detector = fakeDetector({
      xampp: {
        root: 'C:\\xampp',
        myIniPath: 'C:\\xampp\\mysql\\bin\\my.ini',
        mysqldPath: 'C:\\xampp\\mysql\\bin\\mysqld.exe',
      },
      xamppDetectionMethod: 'known-candidate',
      mariadbVersion: '10.4.32-MariaDB',
      service: { name: 'mysql', status: 'running' },
      process: { running: true, pid: 123, path: 'C:\\xampp\\mysql\\bin\\mysqld.exe' },
      secureKeys: { path: 'C:\\SecureKeys', exists: false },
    });

    const step = new DetectEnvironmentStep(detector);
    const result = await step.execute(makeContext());

    expect(result.ok).toBe(true);
    expect(result.data?.detection).toBeDefined();
  });

  it('fails when no XAMPP root is found', async () => {
    const detector = fakeDetector({
      xampp: { root: null, myIniPath: null, mysqldPath: null },
      xamppDetectionMethod: 'not-found',
      mariadbVersion: null,
      service: { name: null, status: 'not-found' },
      process: { running: false, pid: null, path: null },
      secureKeys: { path: 'C:\\SecureKeys', exists: false },
    });

    const step = new DetectEnvironmentStep(detector);
    const result = await step.execute(makeContext());

    expect(result.ok).toBe(false);
  });

  it('is a no-op on rollback since detection never mutates anything', async () => {
    const step = new DetectEnvironmentStep();
    const result = await step.rollback(makeContext());

    expect(result.ok).toBe(true);
  });
});
