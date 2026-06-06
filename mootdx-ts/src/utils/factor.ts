import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { get_stock_market } from "./index";
import type { FactorRecord } from "../types";
import { createLogger } from "../logger";

const log = createLogger("factor");

const SINA_URL = "https://finance.sina.com.cn/realstock/company/{}/{}.js";

function factorCachePath(symbol: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  const dir = join(home, ".mootdx", "caches", "factor");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, `${symbol}.json`);
}

function parseSinaFactorResponse(text: string): [string, number][] {
  const eq = text.indexOf("=");
  if (eq === -1) return [];
  const jsonStr = text.slice(eq + 1).split("\n")[0]!;
  const obj = JSON.parse(jsonStr) as { data?: [string, number][] };
  return obj.data ?? [];
}

export async function fqFactor(
  symbol: string,
  method: string = "qfq",
): Promise<FactorRecord[]> {
  const code = symbol.replace(/^(sh|sz|bj)/i, "");
  const market = get_stock_market(code, true) as string;
  const fullSymbol = `${market}${code}`;

  const cachePath = factorCachePath(fullSymbol);
  const CACHE_TTL = 24 * 3600 * 1000;

  if (existsSync(cachePath)) {
    try {
      const { mtimeMs } = require("node:fs").statSync(cachePath) as { mtimeMs: number };
      if (Date.now() - mtimeMs < CACHE_TTL) {
        const raw = readFileSync(cachePath, "utf-8");
        return JSON.parse(raw) as FactorRecord[];
      }
    } catch { /* fall through */ }
  }

  const url = SINA_URL.replace("{}", fullSymbol).replace("{}", method);
  try {
    const resp = await fetch(url);
    const text = await resp.text();
    const data = parseSinaFactorResponse(text);
    if (data.length === 0) return [];

    const records: FactorRecord[] = data.map(([date, factor]) => ({
      date,
      qfq: method === "qfq" ? factor : 0,
      hfq: method === "hfq" ? factor : 0,
    }));

    try {
      writeFileSync(cachePath, JSON.stringify(records), "utf-8");
    } catch { /* ignore */ }

    return records;
  } catch (err) {
    log.warn(`fqFactor failed for ${fullSymbol}: ${err}`);
    return [];
  }
}
