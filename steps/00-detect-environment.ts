import type { Step, StepContext, StepResult } from '../engine/Step.js';
import { EnvironmentDetector } from '../adapters/EnvironmentDetector.js';

/**
 * Read-only environment survey: XAMPP install path, MariaDB version, my.ini
 * location, service name/status, and whether a SecureKeys directory already
 * exists. This step never mutates anything — validate/execute/verify all
 * revolve around the same read-only scan, and there is nothing to roll back.
 */
export class DetectEnvironmentStep implements Step {
  readonly id = '00-detect-environment';
  readonly description = 'Detect XAMPP install, MariaDB version, service, and existing key material';
  readonly destructive = false;

  constructor(private readonly detector: EnvironmentDetector = new EnvironmentDetector()) {}

  async validate(_ctx: StepContext): Promise<StepResult> {
    // Nothing to precondition-check ahead of a read-only scan.
    return { ok: true };
  }

  async execute(ctx: StepContext): Promise<StepResult> {
    const detection = await this.detector.detect();
    ctx.logger.info({ detection }, 'environment detection result');

    if (!detection.xampp.root) {
      return {
        ok: false,
        message:
          'Could not locate a XAMPP install via known paths, the registry, or a running mysqld.exe process. ' +
          'Set XAMPP_HOME to override.',
      };
    }

    return { ok: true, data: { detection } };
  }

  async verify(_ctx: StepContext): Promise<StepResult> {
    // Detection has no side effect to confirm beyond execute() having found something.
    return { ok: true };
  }

  async rollback(_ctx: StepContext): Promise<StepResult> {
    return { ok: true, message: 'Nothing to roll back — detection is read-only.' };
  }
}
