import type { Logger } from './Logger.js';

/**
 * Context passed to every stage of a Step. `profile` is intentionally `unknown`
 * here — it becomes a typed Profile once profile.schema.json + ajv validation
 * land in Milestone 3. Steps must never hardcode a config key name; they read
 * everything DB-flavor-specific from `profile`.
 */
export interface StepContext {
  dryRun: boolean;
  profile: unknown;
  logger: Logger;
}

export interface StepResult {
  ok: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

export interface Step {
  readonly id: string;
  readonly description: string;
  /**
   * Destructive steps (plaintext key deletion, ALTER TABLE ... ENCRYPTION) must
   * require distinctly stronger confirmation UX in the CLI layer than
   * reversible config edits. This flag lets cli/prompts/confirmStep.ts branch
   * on it without steps/ needing to know about prompt UI at all.
   */
  readonly destructive: boolean;

  /** Read-only checks — must not mutate anything, even in non-dry-run mode. */
  validate(ctx: StepContext): Promise<StepResult>;
  /** Performs the actual mutation. Never called when ctx.dryRun is true. */
  execute(ctx: StepContext): Promise<StepResult>;
  /** Confirms the mutation actually took effect (e.g. plugin ACTIVE, not just "command didn't error"). */
  verify(ctx: StepContext): Promise<StepResult>;
  /** Reverts this step's effects. Called by `sleepyhead rollback`. */
  rollback(ctx: StepContext): Promise<StepResult>;
}
