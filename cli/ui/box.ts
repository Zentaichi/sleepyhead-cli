import { c, palette, glyph, padEnd, terminalWidth, visibleLength } from './theme.js';

/**
 * Low-level bordered container. Draws a rounded box (╭──╮) around `lines`,
 * with an optional titled header bar. Content is wrapped/padded to a visible
 * width capped at the terminal (minus a margin) so it never overflows.
 */
export interface BoxOptions {
  title?: string;
  lines: string[];
  width?: number;
  accent?: string;
  margin?: number;
}

export function box(opts: BoxOptions): string {
  const accent = opts.accent ?? palette.blue;
  const margin = opts.margin ?? 2;
  const innerMax = Math.max(
    0,
    ...opts.lines.map((l) => visibleLength(l)),
    opts.title ? visibleLength(opts.title) + 2 : 0,
  );
  const maxW = terminalWidth() - margin * 2;
  const width = Math.min(opts.width ?? innerMax + 4, maxW);
  const innerW = width - 4;

  const TL = c.hex(accent)('╭');
  const TR = c.hex(accent)('╮');
  const BL = c.hex(accent)('╰');
  const BR = c.hex(accent)('╯');
  const H = c.hex(accent)('─');
  const V = c.hex(accent)('│');

  const out: string[] = [];
  if (opts.title) {
    const t = `${glyph.diamond} ${opts.title}`;
    out.push(`${TL}${H} ${padEnd(t, innerW - 2)} ${TR}`);
  } else {
    out.push(`${TL}${H.repeat(innerW + 2)}${TR}`);
  }
  for (const line of opts.lines) {
    out.push(`${V} ${padEnd(line, innerW)} ${V}`);
  }
  out.push(`${BL}${H.repeat(innerW + 2)}${BR}`);
  return out.join('\n');
}

export function printBox(opts: BoxOptions): void {
  console.log(box(opts));
  console.log();
}

/** A section header with a left accent bar — used to group key/value rows. */
export function section(title: string): string {
  return `${c.indigo(glyph.diamond)} ${c.bold(c.sky(title))}`;
}

/** A key/value row, label right-aligned in a fixed gutter for tidy columns. */
export function kv(label: string, value: string, gutter = 16): string {
  const padded = padEnd(`  ${label}`, gutter);
  return `${c.muted(padded)} ${value}`;
}

/** A thin separator rule across the given visible width. */
export function divider(width?: number): string {
  const w = width ?? Math.min(terminalWidth() - 2, 60);
  return c.faint('─'.repeat(w));
}

export type BadgeKind = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

const BADGE_COLOR: Record<BadgeKind, (s: string) => string> = {
  ok: c.success,
  warn: c.warn,
  danger: c.danger,
  info: c.sky,
  neutral: c.muted,
};

/** Renders a small `[ label ]` pill in a status color. */
export function badge(text: string, kind: BadgeKind = 'neutral'): string {
  return BADGE_COLOR[kind](`[ ${text} ]`);
}

/** Renders a yes/no state as a colored badge. */
export function ynBadge(yes: boolean, yesText = 'yes', noText = 'no'): string {
  return yes ? badge(yesText, 'ok') : badge(noText, 'neutral');
}
