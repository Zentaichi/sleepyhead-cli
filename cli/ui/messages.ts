import { c, palette, glyph } from './theme.js';
import { box } from './box.js';

/** Styled panel for commands that are planned but not yet wired up. */
export function comingSoon(command: string, milestone: string): void {
  console.log(
    box({
      title: `${glyph.moon} ${command}`,
      accent: palette.indigo,
      lines: [
        c.muted('This command is still') + c.ink(' asleep') + c.muted(' — not yet implemented.'),
        '',
        `${c.faint('planned for')}  ${c.sky(milestone)}`,
        '',
        c.cyan('Run ') + c.bold(`sleepyhead detect`) + c.cyan(' in the meantime to scan your environment.'),
      ],
    }),
  );
  console.log();
}

/** Styled success footer. */
export function printSuccess(message: string): void {
  console.log(`${c.success(glyph.check)} ${c.success(message)}`);
}

/** Styled warning line. */
export function printWarning(message: string): void {
  console.log(`${c.warn(glyph.warn)} ${c.warn(message)}`);
}

/** Styled error block (used for unexpected failures / fatal exits). */
export function printError(message: string, detail?: string): void {
  console.log(
    box({
      title: `${glyph.cross} error`,
      accent: palette.danger,
      lines: [c.ink(message), ...(detail ? [c.muted(detail)] : [])],
    }),
  );
}
