import { c, palette, glyph, padEnd } from './theme.js';
import { badge, type BadgeKind } from './box.js';

export type StepStatus =
  | 'pending'
  | 'validated'
  | 'executed'
  | 'verified'
  | 'failed'
  | 'rolled-back'
  | 'skipped';

export interface StepView {
  id: string;
  description: string;
  status: StepStatus;
  destructive?: boolean;
  detail?: string;
}

const STATUS_META: Record<StepStatus, { glyph: string; color: (s: string) => string; badge: BadgeKind }> = {
  pending: { glyph: glyph.bullet, color: c.faint, badge: 'neutral' },
  validated: { glyph: glyph.check, color: c.sky, badge: 'info' },
  executed: { glyph: glyph.check, color: c.indigo, badge: 'info' },
  verified: { glyph: glyph.check, color: c.success, badge: 'ok' },
  failed: { glyph: glyph.cross, color: c.danger, badge: 'danger' },
  'rolled-back': { glyph: glyph.warn, color: c.warn, badge: 'warn' },
  skipped: { glyph: glyph.bullet, color: c.faint, badge: 'neutral' },
};

export function statusGlyph(status: StepStatus): string {
  return STATUS_META[status].color(STATUS_META[status].glyph);
}

export function statusBadge(status: StepStatus): string {
  return badge(status, STATUS_META[status].badge);
}

/** Renders a single step row: [icon] description  [badge]  (detail). */
export function renderStepRow(step: StepView, index?: number): string {
  const meta = STATUS_META[step.status];
  const idx = index !== undefined ? c.faint(`${(index + 1).toString().padStart(2, ' ')} `) : '';
  const icon = meta.color(meta.glyph);
  const desc = step.destructive ? `${step.description} ${c.faint(glyph.lock)}` : step.description;
  const detail = step.detail ? c.muted(`— ${step.detail}`) : '';
  return `${idx}${icon} ${padEnd(desc, 44)} ${statusBadge(step.status)} ${detail}`;
}

/** Renders the full plan/progress list for a run. */
export function renderStepList(steps: StepView[]): string {
  return steps.map((s, i) => renderStepRow(s, i)).join('\n');
}

/** A compact progress line like "3/8 verified" with a filled bar. */
export function renderProgress(done: number, total: number, width = 24): string {
  const filled = total === 0 ? 0 : Math.round((done / total) * width);
  const bar = c.cyan(glyph.bar.repeat(filled)) + c.faint(glyph.barEmpty.repeat(width - filled));
  const label = c.muted(`${done}/${total}`);
  return `${bar} ${label}`;
}

void palette;
