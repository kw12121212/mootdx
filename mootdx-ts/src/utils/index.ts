import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { FREQUENCY, MARKET_BJ, MARKET_SH, MARKET_SZ } from "../consts";
import { createLogger } from "../logger";
import type { SecurityInfo } from "../types";

const log = createLogger("utils");

export function get_stock_market(symbol: string, asString = false): number | string {
  const lower = symbol.toLowerCase();
  if (lower.startsWith("sh")) {
    return asString ? "sh" : MARKET_SH;
  }
  if (lower.startsWith("sz")) {
    return asString ? "sz" : MARKET_SZ;
  }
  if (lower.startsWith("bj")) {
    return asString ? "bj" : MARKET_BJ;
  }

  const code = symbol.replace(/^(sh|sz|bj)/i, "");

  if (code.startsWith("6") || code.startsWith("50") || code.startsWith("68")) {
    return asString ? "sh" : MARKET_SH;
  }
  if (code.startsWith("0") || code.startsWith("30") || code.startsWith("002")) {
    return asString ? "sz" : MARKET_SZ;
  }
  if (code.startsWith("4") || code.startsWith("8")) {
    return asString ? "bj" : MARKET_BJ;
  }

  return asString ? "sz" : MARKET_SZ;
}

export function get_stock_markets(symbols: string[]): [number, string][] {
  return symbols.map((s) => {
    const market = get_stock_market(s, false) as number;
    const code = s.replace(/^(sh|sz|bj)/i, "");
    return [market, code];
  });
}

export function get_frequency(frequency: string | number): number {
  if (typeof frequency === "number") return frequency;
  const idx = FREQUENCY.indexOf(frequency as typeof FREQUENCY[number]);
  return idx === -1 ? 0 : idx;
}

export function md5sum(filepath: string): string | null {
  try {
    const data = readFileSync(filepath);
    return createHash("md5").update(data).digest("hex");
  } catch {
    log.warn(`md5sum failed for ${filepath}`);
    return null;
  }
}

export function get_config_path(name = "config.json"): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  const dir = join(home, ".mootdx");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return join(dir, name);
}

export function to_file(data: Record<string, unknown>[], filename: string | null): void {
  if (!data || !filename) return;

  const ext = filename.split(".").pop()?.toLowerCase();
  const dir = dirname(filename);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (ext === "json") {
    writeFileSync(filename, JSON.stringify(data, null, 2), "utf-8");
  } else if (ext === "csv") {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]!);
    const rows = [headers.join(",")];
    for (const row of data) {
      rows.push(headers.map((h) => JSON.stringify(row[h] ?? "")).join(","));
    }
    writeFileSync(filename, rows.join("\n"), "utf-8");
  }
}

export async function stock_bj_a(): Promise<SecurityInfo[]> {
  const url = "https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=500&fs=b:BK0BJ1&fields=f12,f14";
  try {
    const resp = await fetch(url);
    const json = (await resp.json()) as { data?: { diff?: { f12: string; f14: string }[] } };
    const items = json.data?.diff ?? [];
    return items.map((item) => ({
      market: MARKET_BJ,
      code: item.f12,
      name: item.f14,
    }));
  } catch {
    log.warn("Failed to fetch Beijing A-share list");
    return [];
  }
}
