import { c, palette, glyph } from './theme.js';
import { box } from './box.js';

export interface DiffOptions {
  title?: string;
  context?: number;
}

interface DiffOp {
  kind: 'same' | 'add' | 'del';
  text: string;
}

/** Classic LCS over lines -> add/del/same ops. */
function diffLines(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: 'same', text: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      ops.push({ kind: 'del', text: a[i]! });
      i++;
    } else {
      ops.push({ kind: 'add', text: b[j]! });
      j++;
    }
  }
  while (i < n) ops.push({ kind: 'del', text: a[i++]! });
  while (j < m) ops.push({ kind: 'add', text: b[j++]! });
  return ops;
}

function colorOp(op: DiffOp): string {
  if (op.kind === 'add') return `${c.success('+')} ${c.success(op.text)}`;
  if (op.kind === 'del') return `${c.danger('-')} ${c.danger(op.text)}`;
  return `${c.faint(' ')} ${c.faint(op.text)}`;
}

/**
 * Renders a colored unified diff between two text blocks, collapsing long runs
 * of unchanged lines to keep the output readable. When there are no changes it
 * reports that explicitly instead of an empty box.
 */
export function renderDiff(before: string, after: string, opts: DiffOptions = {}): string {
  const a = before.split('\n');
  const b = after.split('\n');
  const ops = diffLines(a, b);
  const ctx = opts.context ?? 3;

  const adds = ops.filter((o) => o.kind === 'add').length;
  const dels = ops.filter((o) => o.kind === 'del').length;

  if (adds === 0 && dels === 0) {
    return box({
      title: opts.title ?? 'config diff',
      accent: palette.cyan,
      lines: [c.muted('no changes — before and after are identical')],
    });
  }

  // Collapse runs of unchanged lines, keeping `ctx` lines of context at each end.
  const out: string[] = [];
  let run: string[] = [];
  const flush = (keep: number) => {
    if (run.length === 0) return;
    const head = run.slice(0, keep);
    const tail = run.slice(run.length - keep);
    if (keep > 0 && run.length > keep * 2) {
      for (const l of head) out.push(colorOp({ kind: 'same', text: l }));
      out.push(c.faint(`  … ${run.length - keep * 2} unchanged line${run.length - keep * 2 === 1 ? '' : 's'} …`));
      for (const l of tail) out.push(colorOp({ kind: 'same', text: l }));
    } else {
      for (const l of run) out.push(colorOp({ kind: 'same', text: l }));
    }
    run = [];
  };

  for (const op of ops) {
    if (op.kind === 'same') {
      run.push(op.text);
      continue;
    }
    flush(ctx);
    out.push(colorOp(op));
  }
  flush(ctx);

  const summary = `${c.success(`+${adds} added`)}   ${c.danger(`-${dels} removed`)}`;
  return box({
    title: opts.title ?? 'config diff',
    accent: palette.blue,
    lines: [summary, ...out],
  });
}

void glyph;
