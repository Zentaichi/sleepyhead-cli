import { describe, it, expect, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { StepEngine } from '../../engine/StepEngine.js';
import { WizardState } from '../../engine/WizardState.js';
import { createLogger } from '../../engine/Logger.js';
import { AlwaysSucceedsStep, FailsOnceThenSucceedsStep, DestructiveStep } from './fakeSteps.js';

const TEST_STATE_DIR = './.test-state';
const TEST_LOG_DIR = './.test-logs';

describe('StepEngine resume + rollback plumbing', () => {
  afterEach(async () => {
    await fs.rm(TEST_STATE_DIR, { recursive: true, force: true });
    await fs.rm(TEST_LOG_DIR, { recursive: true, force: true });
  });

  it('runs a full sequence of fake steps to completion', async () => {
    const steps = [new AlwaysSucceedsStep('a'), new AlwaysSucceedsStep('b')];
    const state = await WizardState.createNew(
      'fake-profile',
      steps.map((s) => s.id),
      TEST_STATE_DIR
    );
    const logger = createLogger(state.runId, TEST_LOG_DIR);
    const engine = new StepEngine(steps, state, { dryRun: false, profile: {}, logger });

    const result = await engine.run();

    expect(result.ok).toBe(true);
    expect(state.isComplete()).toBe(true);
  });

  it('stops on failure and resumes correctly from a reloaded WizardState', async () => {
    const flaky = new FailsOnceThenSucceedsStep('flaky');
    const steps = [new AlwaysSucceedsStep('a'), flaky, new AlwaysSucceedsStep('c')];
    const state = await WizardState.createNew(
      'fake-profile',
      steps.map((s) => s.id),
      TEST_STATE_DIR
    );
    const logger = createLogger(state.runId, TEST_LOG_DIR);
    const engine = new StepEngine(steps, state, { dryRun: false, profile: {}, logger });

    const firstRun = await engine.run();
    expect(firstRun.ok).toBe(false);
    expect(firstRun.failedStepId).toBe('flaky');
    expect(state.getStepRecord('a')?.status).toBe('verified');
    expect(state.getStepRecord('flaky')?.status).toBe('failed');
    expect(state.getStepRecord('c')?.status).toBe('pending');

    // Simulate a crash + restart: reload WizardState fresh from disk, exactly
    // as `sleepyhead-cli harden --resume` would.
    const reloadedState = await WizardState.loadExisting(TEST_STATE_DIR);
    expect(reloadedState).not.toBeNull();
    const reloadedEngine = new StepEngine(steps, reloadedState!, {
      dryRun: false,
      profile: {},
      logger,
    });

    const secondRun = await reloadedEngine.run();
    expect(secondRun.ok).toBe(true);
    expect(reloadedState!.isComplete()).toBe(true);
    // Step "a" must NOT have been re-executed — resume should skip already-verified steps.
    expect(reloadedState!.getStepRecord('a')?.status).toBe('verified');
  });

  it('rolls back a destructive step and marks it in WizardState', async () => {
    const destructive = new DestructiveStep('boom');
    const steps = [destructive];
    const state = await WizardState.createNew('fake-profile', ['boom'], TEST_STATE_DIR);
    const logger = createLogger(state.runId, TEST_LOG_DIR);
    const engine = new StepEngine(steps, state, { dryRun: false, profile: {}, logger });

    await engine.run();
    const rollbackResult = await engine.rollbackStep('boom');

    expect(rollbackResult.ok).toBe(true);
    expect(destructive.rolledBack).toBe(true);
    expect(state.getStepRecord('boom')?.status).toBe('rolled-back');
  });

  it('stops after validate in dry-run mode without calling execute', async () => {
    const step = new AlwaysSucceedsStep('dry');
    let executeCalled = false;
    const originalExecute = step.execute.bind(step);
    step.execute = async (ctx) => {
      executeCalled = true;
      return originalExecute(ctx);
    };

    const state = await WizardState.createNew('fake-profile', ['dry'], TEST_STATE_DIR);
    const logger = createLogger(state.runId, TEST_LOG_DIR);
    const engine = new StepEngine([step], state, { dryRun: true, profile: {}, logger });

    await engine.run();

    expect(executeCalled).toBe(false);
    expect(state.getStepRecord('dry')?.status).toBe('validated');
  });
});
