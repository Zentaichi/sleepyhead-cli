import { describe, it, expect, afterEach } from 'vitest';
import { EnvironmentDetector, type EnvironmentDetectorDeps } from '../../adapters/EnvironmentDetector.js';

function makeDeps(overrides: Partial<EnvironmentDetectorDeps> = {}): EnvironmentDetectorDeps {
  return {
    pathExists: async () => false,
    runCommand: async () => {
      throw new Error('command not mocked for this test');
    },
    ...overrides,
  };
}

describe('EnvironmentDetector', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('finds the first existing XAMPP root candidate and builds Windows-style paths', async () => {
    const deps = makeDeps({ pathExists: async (p) => p === 'D:\\xampp' });
    const detector = new EnvironmentDetector(deps);

    const result = await detector.detect();

    expect(result.xampp.root).toBe('D:\\xampp');
    expect(result.xampp.myIniPath).toBe('D:\\xampp\\mysql\\bin\\my.ini');
    expect(result.xampp.mysqldPath).toBe('D:\\xampp\\mysql\\bin\\mysqld.exe');
    expect(result.xamppDetectionMethod).toBe('known-candidate');
  });

  it('prefers XAMPP_HOME override when set, over everything else', async () => {
    process.env.XAMPP_HOME = 'E:\\custom-xampp';
    const deps = makeDeps({ pathExists: async (p) => p === 'E:\\custom-xampp' });
    const detector = new EnvironmentDetector(deps);

    const result = await detector.detect();

    expect(result.xampp.root).toBe('E:\\custom-xampp');
    expect(result.xamppDetectionMethod).toBe('env-override');
  });

  it('falls back to the registry InstallLocation when no fixed candidate matches', async () => {
    const deps = makeDeps({
      pathExists: async (p) => p === 'F:\\Custom\\XamppFolder',
      runCommand: async (cmd, args) => {
        if (cmd === 'powershell.exe' && args.some((a) => a.includes('InstallLocation'))) {
          return { stdout: 'F:\\Custom\\XamppFolder\r\n', stderr: '' };
        }
        throw new Error('not mocked');
      },
    });
    const detector = new EnvironmentDetector(deps);

    const result = await detector.detect();

    expect(result.xampp.root).toBe('F:\\Custom\\XamppFolder');
    expect(result.xamppDetectionMethod).toBe('registry');
  });

  it('falls back to a running mysqld.exe process when candidates and registry both miss', async () => {
    const deps = makeDeps({
      pathExists: async (p) => p === 'G:\\Weird\\Location\\xampp',
      runCommand: async (cmd, args) => {
        if (cmd === 'powershell.exe' && args.some((a) => a.includes('InstallLocation'))) {
          return { stdout: '', stderr: '' }; // registry lookup misses
        }
        if (cmd === 'powershell.exe' && args.some((a) => a.includes('Win32_Process'))) {
          return {
            stdout: JSON.stringify({
              ProcessId: 4242,
              ExecutablePath: 'G:\\Weird\\Location\\xampp\\mysql\\bin\\mysqld.exe',
            }),
            stderr: '',
          };
        }
        throw new Error('not mocked');
      },
    });
    const detector = new EnvironmentDetector(deps);

    const result = await detector.detect();

    expect(result.xampp.root).toBe('G:\\Weird\\Location\\xampp');
    expect(result.xamppDetectionMethod).toBe('running-process');
    expect(result.process).toEqual({
      running: true,
      pid: 4242,
      path: 'G:\\Weird\\Location\\xampp\\mysql\\bin\\mysqld.exe',
    });
  });

  it('reports process running=false when no mysqld.exe process is found', async () => {
    const deps = makeDeps({
      runCommand: async (cmd, args) => {
        if (cmd === 'powershell.exe' && args.some((a) => a.includes('Win32_Process'))) {
          return { stdout: '', stderr: '' };
        }
        throw new Error('not mocked');
      },
    });
    const detector = new EnvironmentDetector(deps);

    const result = await detector.detect();

    expect(result.process).toEqual({ running: false, pid: null, path: null });
  });

  it('reports a running process independently of Windows service status (the XAMPP bare-process case)', async () => {
    const deps = makeDeps({
      pathExists: async (p) => p === 'C:\\xampp',
      runCommand: async (cmd, args) => {
        if (cmd === 'powershell.exe' && args.some((a) => a.includes('Win32_Process'))) {
          return {
            stdout: JSON.stringify({ ProcessId: 111, ExecutablePath: 'C:\\xampp\\mysql\\bin\\mysqld.exe' }),
            stderr: '',
          };
        }
        // sc query (via WindowsServiceAdapter) and registry lookup both miss.
        throw new Error('not mocked');
      },
    });
    const detector = new EnvironmentDetector(deps);

    const result = await detector.detect();

    expect(result.service).toEqual({ name: null, status: 'not-found' });
    expect(result.process.running).toBe(true);
  });

  it('reports no XAMPP root when every strategy misses, and skips version detection', async () => {
    const detector = new EnvironmentDetector(makeDeps());

    const result = await detector.detect();

    expect(result.xampp.root).toBeNull();
    expect(result.xamppDetectionMethod).toBe('not-found');
    expect(result.mariadbVersion).toBeNull();
  });

  it('parses the MariaDB version out of mysqld --version output', async () => {
    const deps = makeDeps({
      pathExists: async (p) => p === 'C:\\xampp',
      runCommand: async (cmd, args) => {
        if (cmd === 'C:\\xampp\\mysql\\bin\\mysqld.exe' && args[0] === '--version') {
          return { stdout: 'mysqld.exe  Ver 10.4.32-MariaDB for Win64 on AMD64\n', stderr: '' };
        }
        throw new Error(`not mocked: ${cmd} ${args.join(' ')}`);
      },
    });
    const detector = new EnvironmentDetector(deps);

    const result = await detector.detect();

    expect(result.mariadbVersion).toBe('10.4.32-MariaDB');
  });

  it('detects a running service by trying candidate names in order', async () => {
    const deps = makeDeps({
      runCommand: async (cmd, args) => {
        if (cmd === 'sc' && args[0] === 'query' && args[1] === 'mysql') {
          return {
            stdout:
              'SERVICE_NAME: mysql\n        TYPE               : 10  WIN32_OWN_PROCESS\n        STATE              : 4  RUNNING\n',
            stderr: '',
          };
        }
        throw new Error('not this candidate');
      },
    });
    const detector = new EnvironmentDetector(deps);

    const result = await detector.detect();

    expect(result.service).toEqual({ name: 'mysql', status: 'running' });
  });

  it('reports not-found when no candidate service name resolves', async () => {
    const detector = new EnvironmentDetector(makeDeps());

    const result = await detector.detect();

    expect(result.service).toEqual({ name: null, status: 'not-found' });
  });

  it('reports whether the SecureKeys directory exists, honoring an override', async () => {
    process.env.SECURE_KEYS_DIR = 'C:\\CustomKeys';
    const deps = makeDeps({ pathExists: async (p) => p === 'C:\\CustomKeys' });
    const detector = new EnvironmentDetector(deps);

    const result = await detector.detect();

    expect(result.secureKeys).toEqual({ path: 'C:\\CustomKeys', exists: true });
  });

  it('defaults the SecureKeys path when no override is set', async () => {
    const detector = new EnvironmentDetector(makeDeps());

    const result = await detector.detect();

    expect(result.secureKeys.path).toBe('C:\\SecureKeys');
    expect(result.secureKeys.exists).toBe(false);
  });
});
