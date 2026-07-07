import type { Step, StepContext, StepResult } from '../../engine/Step.js';

/** Always succeeds — proves the happy path through the engine. */
export class AlwaysSucceedsStep implements Step {
  readonly destructive = false;
  constructor(
    public readonly id: string,
    public readonly description = 'fake step (succeeds)'
  ) {}

  async validate(_ctx: StepContext): Promise<StepResult> {
    return { ok: true };
  }
  async execute(_ctx: StepContext): Promise<StepResult> {
    return { ok: true };
  }
  async verify(_ctx: StepContext): Promise<StepResult> {
    return { ok: true };
  }
  async rollback(_ctx: StepContext): Promise<StepResult> {
    return { ok: true, message: 'nothing to roll back' };
  }
}

/** Fails on execute exactly once, then succeeds — simulates a crash-then-resume scenario. */
export class FailsOnceThenSucceedsStep implements Step {
  readonly destructive = false;
  private attempts = 0;
  constructor(
    public readonly id: string,
    public readonly description = 'fake step (fails once)'
  ) {}

  async validate(_ctx: StepContext): Promise<StepResult> {
    return { ok: true };
  }
  async execute(_ctx: StepContext): Promise<StepResult> {
    this.attempts += 1;
    if (this.attempts === 1) return { ok: false, message: 'simulated failure on first attempt' };
    return { ok: true };
  }
  async verify(_ctx: StepContext): Promise<StepResult> {
    return { ok: true };
  }
  async rollback(_ctx: StepContext): Promise<StepResult> {
    return { ok: true, message: 'rolled back simulated step' };
  }
}

/** A destructive step whose rollback is tracked, to prove rollback plumbing actually runs. */
export class DestructiveStep implements Step {
  readonly destructive = true;
  public rolledBack = false;
  constructor(
    public readonly id: string,
    public readonly description = 'fake destructive step'
  ) {}

  async validate(_ctx: StepContext): Promise<StepResult> {
    return { ok: true };
  }
  async execute(_ctx: StepContext): Promise<StepResult> {
    return { ok: true };
  }
  async verify(_ctx: StepContext): Promise<StepResult> {
    return { ok: true };
  }
  async rollback(_ctx: StepContext): Promise<StepResult> {
    this.rolledBack = true;
    return { ok: true };
  }
}
