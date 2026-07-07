import type { Step, StepContext, StepResult } from './Step.js';
import { WizardState } from './WizardState.js';
import type { Logger } from './Logger.js';

export interface StepEngineOptions {
  dryRun: boolean;
  profile: unknown;
  logger: Logger;
}

/**
 * Drives a sequence of Steps through validate -> execute -> verify,
 * persisting status via WizardState after every stage so a crash mid-step
 * leaves an accurate record of what actually completed. `run()` always
 * starts from `WizardState.nextPendingStepId()`, which is what makes resume
 * "just work" — resuming is simply constructing the engine with a
 * WizardState loaded from disk instead of a fresh one.
 */
export class StepEngine {
  constructor(
    private readonly steps: Step[],
    private readonly state: WizardState,
    private readonly options: StepEngineOptions
  ) {}

  private buildContext(): StepContext {
    return { dryRun: this.options.dryRun, profile: this.options.profile, logger: this.options.logger };
  }

  private findStep(id: string): Step {
    const step = this.steps.find((s) => s.id === id);
    if (!step) throw new Error(`No step registered with id "${id}"`);
    return step;
  }

  async run(): Promise<{ ok: boolean; failedStepId?: string }> {
    let nextId = this.state.nextPendingStepId();

    while (nextId) {
      const step = this.findStep(nextId);
      const ctx = this.buildContext();
      this.options.logger.info({ stepId: step.id }, 'step:start');

      const outcome = await this.runSingleStep(step, ctx);
      if (!outcome.ok) {
        this.options.logger.error({ stepId: step.id, error: outcome.message }, 'step:failed');
        return { ok: false, failedStepId: step.id };
      }

      this.options.logger.info({ stepId: step.id }, 'step:done');
      nextId = this.state.nextPendingStepId();
    }

    return { ok: true };
  }

  private async runSingleStep(step: Step, ctx: StepContext): Promise<StepResult> {
    const validation = await step.validate(ctx);
    if (!validation.ok) {
      await this.state.markStatus(step.id, 'failed', validation.message);
      return validation;
    }
    await this.state.markStatus(step.id, 'validated');

    if (ctx.dryRun) {
      // Dry-run stops here by design: show what *would* happen, mutate nothing.
      return { ok: true, message: 'dry-run: validation passed, no changes made' };
    }

    const execution = await step.execute(ctx);
    if (!execution.ok) {
      await this.state.markStatus(step.id, 'failed', execution.message);
      return execution;
    }
    await this.state.markStatus(step.id, 'executed');

    const verification = await step.verify(ctx);
    if (!verification.ok) {
      await this.state.markStatus(step.id, 'failed', verification.message);
      return verification;
    }
    await this.state.markStatus(step.id, 'verified');

    return verification;
  }

  /** Used by `sleepyhead rollback` to revert a single step. */
  async rollbackStep(id: string): Promise<StepResult> {
    const step = this.findStep(id);
    const ctx = this.buildContext();
    const result = await step.rollback(ctx);
    await this.state.markStatus(id, result.ok ? 'rolled-back' : 'failed', result.message);
    return result;
  }
}
