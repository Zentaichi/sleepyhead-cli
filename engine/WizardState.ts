import { promises as fs } from 'node:fs';
import path from 'node:path';

export type StepStatus = 'pending' | 'validated' | 'executed' | 'verified' | 'failed' | 'rolled-back';

export interface StepRecord {
  id: string;
  status: StepStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export interface WizardStateData {
  runId: string;
  profileName: string;
  createdAt: string;
  updatedAt: string;
  steps: StepRecord[];
}

const DEFAULT_STATE_DIR = './.sleepyhead-state';
const STATE_FILENAME = 'wizard-state.json';

/**
 * Persisted, resumable state for a single hardening run. This is what lets
 * `sleepyhead-cli harden --resume` pick up from the last verified step after
 * a crash or a reboot triggered by a service restart, instead of restarting
 * the whole flow (and re-running steps that already mutated state).
 */
export class WizardState {
  private data: WizardStateData;
  private readonly filePath: string;

  private constructor(data: WizardStateData, filePath: string) {
    this.data = data;
    this.filePath = filePath;
  }

  static async createNew(
    profileName: string,
    stepIds: string[],
    stateDir = DEFAULT_STATE_DIR
  ): Promise<WizardState> {
    const now = new Date().toISOString();
    const data: WizardStateData = {
      runId: `run-${Date.now()}`,
      profileName,
      createdAt: now,
      updatedAt: now,
      steps: stepIds.map((id) => ({ id, status: 'pending' as const })),
    };
    const filePath = path.join(stateDir, STATE_FILENAME);
    const state = new WizardState(data, filePath);
    await state.persist();
    return state;
  }

  static async loadExisting(stateDir = DEFAULT_STATE_DIR): Promise<WizardState | null> {
    const filePath = path.join(stateDir, STATE_FILENAME);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(raw) as WizardStateData;
      return new WizardState(data, filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  get runId(): string {
    return this.data.runId;
  }

  getStepRecord(id: string): StepRecord | undefined {
    return this.data.steps.find((s) => s.id === id);
  }

  /** First step that still needs to run — pending, or failed (so a fixed retry can resume onto it). */
  nextPendingStepId(): string | undefined {
    const rec = this.data.steps.find((s) => s.status === 'pending' || s.status === 'failed');
    return rec?.id;
  }

  async markStatus(id: string, status: StepStatus, error?: string): Promise<void> {
    const rec = this.data.steps.find((s) => s.id === id);
    if (!rec) throw new Error(`Unknown step id in wizard state: ${id}`);

    if (status === 'validated' && !rec.startedAt) {
      rec.startedAt = new Date().toISOString();
    }
    if (status === 'verified' || status === 'failed' || status === 'rolled-back') {
      rec.finishedAt = new Date().toISOString();
    }
    rec.status = status;
    if (error === undefined) {
      delete rec.error;
    } else {
      rec.error = error;
    }
    this.data.updatedAt = new Date().toISOString();
    await this.persist();
  }

  isComplete(): boolean {
    return this.data.steps.every((s) => s.status === 'verified');
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }
}
