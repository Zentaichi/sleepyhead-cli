import pino from 'pino';

export type Logger = pino.Logger;

/**
 * One logger per run: pretty-printed to the terminal, and a full structured
 * JSON trace written to logs/<runId>.log for the audit trail requirement
 * (every command run, every file touched, every verify result).
 */
export function createLogger(runId: string, logDir = './logs'): Logger {
  const transport = pino.transport({
    targets: [
      {
        target: 'pino-pretty',
        level: process.env.LOG_LEVEL ?? 'info',
        options: { colorize: true, translateTime: 'SYS:standard' },
      },
      {
        target: 'pino/file',
        level: 'trace',
        options: { destination: `${logDir}/${runId}.log`, mkdir: true },
      },
    ],
  });

  return pino({ level: 'trace', base: { runId } }, transport);
}
