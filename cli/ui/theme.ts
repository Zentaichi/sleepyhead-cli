import chalk from 'chalk';

// We designed a specific truecolor palette, so force 24-bit color output when
// the user hasn't explicitly opted out (NO_COLOR / --no-color). Without this,
// chalk auto-detects a reduced level when piped and maps our blues to the
// nearest of 16 basic colors (e.g. violet -> bright white), breaking the theme.
if (!process.env.NO_COLOR && chalk.level < 3) {
  chalk.level = 3;
}


/**
 * "Sleepy" theme — blue-ish hues for a calm, nocturnal tone.
 * Muted periwinkle ink on deep indigo, with soft cyan/sky highlights and a
 * pale moon accent. Status colors intentionally break from the blues so they
 * read at a glance (teal = ok, amber = caution, rose = danger).
 */
export const palette = {
  ink: '#cfe0ff',
  muted: '#7e8db8',
  faint: '#56638a',
  indigo: '#5b7cc4',
  blue: '#4a90e2',
  sky: '#7ec8ff',
  cyan: '#67e8f9',
  moon: '#e8f0ff',
  violet: '#a78bfa',
  success: '#5fd3a3',
  warn: '#f0c674',
  danger: '#ff7a93',
  dimBg: '#1b2236',
} as const;

export const c = {
  bold: chalk.bold,
  dim: chalk.dim,
  italic: chalk.italic,
  hex: chalk.hex,
  ink: chalk.hex(palette.ink),
  muted: chalk.hex(palette.muted),
  faint: chalk.hex(palette.faint),
  indigo: chalk.hex(palette.indigo),
  blue: chalk.hex(palette.blue),
  sky: chalk.hex(palette.sky),
  cyan: chalk.hex(palette.cyan),
  moon: chalk.hex(palette.moon),
  violet: chalk.hex(palette.violet),
  success: chalk.hex(palette.success),
  warn: chalk.hex(palette.warn),
  danger: chalk.hex(palette.danger),
};

/** Monochrome-ish glyphs (no emoji, for max terminal compatibility). */
export const glyph = {
  check: '✓',
  cross: '✗',
  warn: '⚠',
  arrow: '▸',
  diamond: '◆',
  bullet: '•',
  star: '✦',
  moon: '☾',
  bar: '▰',
  barEmpty: '▱',
  lock: '⚿',
} as const;

export function terminalWidth(fallback = 80): number {
  const cols = process.stdout.columns;
  return typeof cols === 'number' && cols > 0 ? cols : fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Horizontal gradient across the characters of a single line. */
export function gradient(text: string, from: string, to: string): string {
  const chars = [...text];
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  const last = Math.max(chars.length - 1, 1);
  return chars
    .map((ch, i) => {
      const t = i / last;
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return ch === ' ' ? ch : chalk.rgb(r, g, b)(ch);
    })
    .join('');
}

/** Vertical gradient across an array of lines (top -> bottom). */
export function vGradient(lines: string[], from: string, to: string): string[] {
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  const last = Math.max(lines.length - 1, 1);
  return lines.map((line, i) => {
    const t = i / last;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return chalk.rgb(r, g, b)(line);
  });
}

// Build the ANSI-strip regex via constructor (avoids a control char in a regex literal).
const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

/** Visible (printed) length of a string, ignoring ANSI color codes. */
export function visibleLength(s: string): number {
  return s.replace(ANSI_RE, '').length;
}

/** Right-pad a (possibly colored) string to a visible width. */
export function padEnd(s: string, width: number): string {
  const diff = width - visibleLength(s);
  return diff > 0 ? s + ' '.repeat(diff) : s;
}

/** Left-pad a (possibly colored) string to a visible width. */
export function padStart(s: string, width: number): string {
  const diff = width - visibleLength(s);
  return diff > 0 ? ' '.repeat(diff) + s : s;
}

/** Truncate a string to a visible width, keeping colors where possible. */
export function truncate(s: string, width: number): string {
  if (visibleLength(s) <= width) return s;
  let out = '';
  let len = 0;
  for (const ch of s) {
    if (ch === '\x1b') {
      // swallow a whole ANSI sequence
      out += ch;
      continue;
    }
    if (len >= width) break;
    out += ch;
    len += 1;
  }
  return out;
}
