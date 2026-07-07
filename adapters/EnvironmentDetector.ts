import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import { win32 as path } from 'node:path';
import { WindowsServiceAdapter, type ServiceStatus as AdapterServiceStatus } from './WindowsServiceAdapter.js';

const execFileAsync = promisify(execFileCb);

export type ServiceStatus = 'running' | 'stopped' | 'not-found' | 'unknown';

export type XamppDetectionMethod = 'env-override' | 'known-candidate' | 'registry' | 'running-process' | 'not-found';

export interface XamppDetection {
  root: string | null;
  myIniPath: string | null;
  mysqldPath: string | null;
}

export interface ServiceDetection {
  name: string | null;
  status: ServiceStatus;
}

/**
 * Independent of Windows service registration — XAMPP's MariaDB is commonly
 * run as a bare process via the XAMPP Control Panel, with no service ever
 * installed. `service` above can legitimately be not-found while this is
 * running=true; both are reported so the CLI output doesn't imply MariaDB
 * is down when it's actually just unmanaged by the Service Control Manager.
 */
export interface ProcessDetection {
  running: boolean;
  pid: number | null;
  path: string | null;
}

export interface SecureKeysDetection {
  path: string;
  exists: boolean;
}

export interface DetectionResult {
  xampp: XamppDetection;
  xamppDetectionMethod: XamppDetectionMethod;
  mariadbVersion: string | null;
  service: ServiceDetection;
  process: ProcessDetection;
  secureKeys: SecureKeysDetection;
}

/**
 * Injectable seams so detection can be unit-tested on any host OS without
 * touching a real filesystem or shelling out to `sc.exe`/`mysqld.exe`/
 * `powershell.exe`. Production code uses the real fs/execFile-backed
 * defaults below.
 */
export interface EnvironmentDetectorDeps {
  pathExists: (p: string) => Promise<boolean>;
  runCommand: (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
}

const defaultDeps: EnvironmentDetectorDeps = {
  pathExists: async (p: string) => {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  },
  // execFile only, never exec — args are always passed as an array, never
  // string-interpolated, per the plan's shell-injection-safety requirement.
  runCommand: async (cmd: string, args: string[]) => execFileAsync(cmd, args),
};

// Windows-native paths throughout (this tool's target is always a Windows
// host); `path.win32` is used explicitly so path construction is correct
// and deterministically testable even when this code runs/builds on a
// non-Windows machine.
//
// Fixed candidates are checked first (cheap), but XAMPP install paths are
// fully customizable, so detectXampp() falls further back to (a) the
// registry's InstallLocation for XAMPP, since it shows up in Windows'
// Installed Apps list, and (b) the actual running mysqld.exe process's
// executable path, which is correct regardless of install location and
// regardless of whether MariaDB is registered as a service at all.
const XAMPP_ROOT_CANDIDATES = ['C:\\xampp', 'D:\\xampp', 'C:\\Program Files\\xampp'];
const SERVICE_NAME_CANDIDATES = ['mysql', 'MariaDB', 'MySQL'];
const DEFAULT_SECURE_KEYS_DIR = 'C:\\SecureKeys';

export class EnvironmentDetector {
  private readonly serviceAdapter: WindowsServiceAdapter;

  constructor(private readonly deps: EnvironmentDetectorDeps = defaultDeps) {
    // Reuses the same runCommand seam so tests can fake `sc query` output
    // in one place instead of two.
    this.serviceAdapter = new WindowsServiceAdapter(this.deps.runCommand);
  }

  async detect(): Promise<DetectionResult> {
    // Run once, share the result: both root discovery (as a fallback) and
    // the top-level "is it actually running" report need this.
    const runningProcess = await this.detectRunningProcess();

    const { method, ...xampp } = await this.detectXampp(runningProcess);
    const mariadbVersion = xampp.mysqldPath ? await this.detectMariadbVersion(xampp.mysqldPath) : null;
    const service = await this.detectService();
    const secureKeys = await this.detectSecureKeys();

    return { xampp, xamppDetectionMethod: method, mariadbVersion, service, process: runningProcess, secureKeys };
  }

  private async detectXampp(runningProcess: ProcessDetection): Promise<XamppDetection & { method: XamppDetectionMethod }> {
    const override = process.env.XAMPP_HOME;
    if (override && (await this.deps.pathExists(override))) {
      return { ...this.buildXamppPaths(override), method: 'env-override' };
    }

    for (const root of XAMPP_ROOT_CANDIDATES) {
      if (await this.deps.pathExists(root)) {
        return { ...this.buildXamppPaths(root), method: 'known-candidate' };
      }
    }

    const registryRoot = await this.detectByRegistry();
    if (registryRoot && (await this.deps.pathExists(registryRoot))) {
      return { ...this.buildXamppPaths(registryRoot), method: 'registry' };
    }

    if (runningProcess.running && runningProcess.path) {
      // runningProcess.path is <root>\mysql\bin\mysqld.exe by XAMPP's fixed
      // internal layout, regardless of what <root> itself is.
      const root = path.dirname(path.dirname(path.dirname(runningProcess.path)));
      if (await this.deps.pathExists(root)) {
        return { ...this.buildXamppPaths(root), method: 'running-process' };
      }
    }

    return { root: null, myIniPath: null, mysqldPath: null, method: 'not-found' };
  }

  private buildXamppPaths(root: string): XamppDetection {
    return {
      root,
      myIniPath: path.join(root, 'mysql', 'bin', 'my.ini'),
      mysqldPath: path.join(root, 'mysql', 'bin', 'mysqld.exe'),
    };
  }

  private async runPowerShell(script: string): Promise<string> {
    const { stdout } = await this.deps.runCommand('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
    return stdout.trim();
  }

  /** Reads XAMPP's InstallLocation from the registry's Uninstall keys — the same data backing Windows' Installed Apps list. */
  private async detectByRegistry(): Promise<string | null> {
    const script = `
      $paths = @(
        'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
        'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
      )
      Get-ItemProperty $paths -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -like '*XAMPP*' } |
        Select-Object -First 1 -ExpandProperty InstallLocation
    `;
    try {
      const result = await this.runPowerShell(script);
      return result || null;
    } catch {
      return null;
    }
  }

  /** Finds a running mysqld.exe regardless of whether it's registered as a Windows service. */
  private async detectRunningProcess(): Promise<ProcessDetection> {
    const script =
      `Get-CimInstance Win32_Process -Filter "Name='mysqld.exe'" | ` +
      `Select-Object -First 1 ProcessId, ExecutablePath | ConvertTo-Json -Compress`;
    try {
      const stdout = await this.runPowerShell(script);
      if (!stdout || stdout === 'null') return { running: false, pid: null, path: null };

      const parsed = JSON.parse(stdout) as { ProcessId?: number; ExecutablePath?: string };
      if (!parsed?.ProcessId) return { running: false, pid: null, path: null };

      return { running: true, pid: parsed.ProcessId, path: parsed.ExecutablePath ?? null };
    } catch {
      return { running: false, pid: null, path: null };
    }
  }

  private async detectMariadbVersion(mysqldPath: string): Promise<string | null> {
    try {
      const { stdout } = await this.deps.runCommand(mysqldPath, ['--version']);
      // e.g. "mysqld.exe  Ver 10.4.32-MariaDB for Win64 on AMD64"
      const match = stdout.match(/Ver\s+(\S+)/i);
      return match?.[1] ?? (stdout.trim() || null);
    } catch {
      return null;
    }
  }

  private async detectService(): Promise<ServiceDetection> {
    for (const name of SERVICE_NAME_CANDIDATES) {
      const result = await this.serviceAdapter.queryStatus(name);
      if (result.status === 'not-installed') continue;
      return { name: result.name, status: this.mapStatus(result.status) };
    }
    return { name: null, status: 'not-found' };
  }

  private mapStatus(status: AdapterServiceStatus): ServiceStatus {
    if (status === 'not-installed') return 'not-found';
    return status;
  }

  private async detectSecureKeys(): Promise<SecureKeysDetection> {
    const dir = process.env.SECURE_KEYS_DIR ?? DEFAULT_SECURE_KEYS_DIR;
    const exists = await this.deps.pathExists(dir);
    return { path: dir, exists };
  }
}
