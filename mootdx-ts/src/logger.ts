const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;

type LogLevel = keyof typeof LOG_LEVELS;

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

function getCurrentLevel(): number {
  const env = process.env.MOOTDX_LOG_LEVEL?.toLowerCase() ?? "info";
  return LOG_LEVELS[env as LogLevel] ?? LOG_LEVELS.info;
}

export function createLogger(name: string): Logger {
  const prefix = `[mootdx:${name}]`;

  function log(level: LogLevel, ...args: unknown[]): void {
    if (LOG_LEVELS[level] >= getCurrentLevel()) {
      const tag = `${prefix} ${level.toUpperCase()}`;
      switch (level) {
        case "error":
          console.error(tag, ...args);
          break;
        case "warn":
          console.warn(tag, ...args);
          break;
        default:
          console.log(tag, ...args);
      }
    }
  }

  return {
    debug: (...args) => log("debug", ...args),
    info: (...args) => log("info", ...args),
    warn: (...args) => log("warn", ...args),
    error: (...args) => log("error", ...args),
  };
}
