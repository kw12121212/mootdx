import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG } from "./consts";
import { createLogger } from "./logger";

const log = createLogger("config");

export interface ConfigData {
  SERVER: Record<string, unknown>;
  BESTIP: Record<string, string>;
  TDXDIR: string;
  [key: string]: unknown;
}

let settings: ConfigData = structuredClone(CONFIG) as ConfigData;

function getConfigPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  const dir = join(home, ".mootdx");
  return join(dir, "config.json");
}

export function getConfig(): ConfigData {
  return settings;
}

export function setup(): boolean {
  const confPath = getConfigPath();
  const dir = join(confPath, "..");

  function loadConfig(): void {
    if (existsSync(confPath)) {
      const raw = readFileSync(confPath, "utf-8");
      const options = JSON.parse(raw) as Partial<ConfigData>;
      settings = { ...settings, ...options };
    }
  }

  try {
    loadConfig();
  } catch {
    log.warn(`Config file not found at ${confPath}, using defaults`);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(confPath, JSON.stringify(settings, null, 2), "utf-8");
    loadConfig();
  }

  return Object.keys(settings).length > 0;
}

export function has(key: string, value: unknown): boolean {
  const entry = settings[key];
  if (entry == null || typeof entry !== "object") return false;
  return String(value) in (entry as Record<string, unknown>);
}

export function set(key: string, value: unknown): void {
  (settings as Record<string, unknown>)[key] = value;
}

export function get(key: string, default_?: unknown): unknown {
  const parts = key.split(".");
  let cfg: unknown = (settings as Record<string, unknown>)[parts[0]!];

  if (parts.length > 1) {
    for (let i = 1; i < parts.length; i++) {
      if (cfg != null && typeof cfg === "object") {
        const obj = cfg as Record<string, unknown>;
        if (obj[parts[i]!] !== undefined) {
          cfg = obj[parts[i]!];
        } else {
          cfg = default_;
          break;
        }
      } else {
        cfg = default_;
        break;
      }
    }
  }

  return cfg;
}

export function path(key: string, value?: string): string {
  return join(process.cwd(), String(settings[key as keyof ConfigData] ?? ""), value ?? "");
}

export function clone(): ConfigData {
  return structuredClone(settings);
}

export function update(options: Partial<ConfigData>): void {
  Object.assign(settings, options);
}
