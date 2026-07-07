import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFileCb);

export type ServiceStatus = 'running' | 'stopped' | 'not-installed' | 'unknown';

export interface ServiceQueryResult {
  name: string;
  status: ServiceStatus;
  raw?: string;
}

/** Matches the shape of a promisified `execFile` — lets tests inject a fake without touching a real Windows service. */
export type ExecFileFn = (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;

/**
 * Isolates Windows service control behind an interface so steps never shell
 * out to `sc`/`net` directly. Query-only for Milestone 2 (detection must
 * stay read-only, no mutation); start()/stop()/restart() are added once a
 * real hardening step needs to bounce the service after a config write.
 */
export class WindowsServiceAdapter {
  constructor(private readonly execFile: ExecFileFn = execFileAsync) {}

  async queryStatus(serviceName: string): Promise<ServiceQueryResult> {
    try {
      const { stdout } = await this.execFile('sc', ['query', serviceName]);
      return { name: serviceName, status: this.parseStatus(stdout), raw: stdout };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const raw = `${e.stderr ?? ''} ${e.stdout ?? ''} ${e.message ?? ''}`.trim();
      // sc.exe rejects (nonzero exit) both when a service name doesn't exist
      // (error 1060) and for other query failures. Since callers here are
      // trying a list of candidate names, any rejection just means "this
      // isn't the right name" — move on to the next candidate.
      return { name: serviceName, status: 'not-installed', raw };
    }
  }

  private parseStatus(scOutput: string): ServiceStatus {
    // sc query output has a line like: "        STATE              : 4  RUNNING"
    if (/STATE\s*:\s*\d+\s+RUNNING/i.test(scOutput)) return 'running';
    if (/STATE\s*:\s*\d+\s+STOPPED/i.test(scOutput)) return 'stopped';
    return 'unknown';
  }
}
