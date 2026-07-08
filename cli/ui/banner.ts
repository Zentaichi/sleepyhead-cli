import { c, palette, glyph, gradient, vGradient, padEnd, terminalWidth } from './theme.js';

/**
 * A sleepy round moon with little "z"s drifting off it — the mascot for the
 * CLI. Drawn in a soft top-to-bottom glow (pale moon -> indigo).
 */
const MOON_ART = [
  '       .-""""-.       ',
  "     .'   __   '.     ",
  '    /    ( zz )   \\    ',
  "   |      \\__/     |   ",
  '    \\             /    ',
  "     '.         .'     ",
  "       '-.___.-'       ",
];

const MOON_W = Math.max(...MOON_ART.map((l) => l.length));

export interface BannerOptions {
  version?: string;
  subtitle?: string;
}

/** Renders the stylized sleepyhead header: a glowing moon beside the wordmark. */
export function renderBanner(opts: BannerOptions = {}): string {
  const titleLine = `${c.bold(gradient('sleepyhead', palette.sky, palette.violet))} ${c.faint('·')} ${c.cyan('TDE hardening')}`;
  const subLine = c.muted(opts.subtitle ?? 'guarded encryption for XAMPP MariaDB / MySQL');
  const tagLine = c.cyan('restful encryption · restful nights');
  const versionLine = opts.version ? c.faint(`v${opts.version}`) : '';

  const right = [titleLine, subLine, tagLine];
  if (versionLine) right.push(versionLine);

  const moon = vGradient(MOON_ART, palette.moon, palette.indigo);
  const rows = Math.max(moon.length, right.length);
  const gap = '   ';

  const artLines: string[] = [];
  for (let i = 0; i < rows; i++) {
    const left = moon[i] ?? ' '.repeat(MOON_W);
    const r = right[i] ?? '';
    artLines.push(`${left}${gap}${r}`);
  }

  const innerW = Math.min(terminalWidth() - 4, Math.max(...artLines.map((l) => l.length)));
  const border = (ch: string) => c.indigo(ch);
  const out: string[] = [];
  out.push(`${border('╭')}${c.indigo('─'.repeat(innerW + 2))}${border('╮')}`);
  out.push(`${border('│')} ${padEnd(`${glyph.moon} ${c.faint('sleepyhead session')}`, innerW)} ${border('│')}`);
  out.push(`${border('╞')}${c.faint('═'.repeat(innerW + 2))}${border('╡')}`);
  for (const l of artLines) {
    out.push(`${border('│')} ${padEnd(l, innerW)} ${border('│')}`);
  }
  out.push(`${border('╰')}${c.indigo('─'.repeat(innerW + 2))}${border('╯')}`);
  return out.join('\n');
}

export function printBanner(opts: BannerOptions = {}): void {
  console.log(renderBanner(opts));
  console.log();
}
