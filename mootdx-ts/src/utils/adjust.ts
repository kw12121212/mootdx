import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { StdQuotes, quotes } from "../quotes";
import type { FactorRecord, OhlcBar, XdxrRecord } from "../types";
import { reversion as doReversion, factorReversion } from "../tools/reversion";
import { createLogger } from "../logger";

const log = createLogger("adjust");

const SINA_HFQ_URL = "https://finance.sina.com.cn/realstock/company/{}/hfq.js";
const SINA_QFQ_URL = "https://finance.sina.com.cn/realstock/company/{}/qfq.js";

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
  const url = method === "hfq"
    ? SINA_HFQ_URL.replace("{}", symbol)
    : SINA_QFQ_URL.replace("{}", symbol);

  try {
    const resp = await fetch(url);
    const text = await resp.text();
    const data = parseSinaFactorResponse(text);
    if (data.length === 0) return [];

    return data.map(([date, factor]) => ({
      date,
      qfq: method === "qfq" ? factor : 0,
      hfq: method === "hfq" ? factor : 0,
    }));
  } catch (err) {
    log.warn(`fqFactor failed for ${symbol}: ${err}`);
    return [];
  }
}

function xdxrCachePath(symbol: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  const dir = join(home, ".mootdx", "xdxr");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, `${symbol}.json`);
}

export async function getXdXr(symbol: string): Promise<XdxrRecord[]> {
  const cachePath = xdxrCachePath(symbol);
  const CACHE_TTL = 24 * 3600 * 1000;

  if (existsSync(cachePath)) {
    try {
      const { mtimeMs } = require("node:fs").statSync(cachePath) as { mtimeMs: number };
      if (Date.now() - mtimeMs < CACHE_TTL) {
        const raw = readFileSync(cachePath, "utf-8");
        return JSON.parse(raw) as XdxrRecord[];
      }
    } catch { /* fall through */ }
  }

  const q = (await quotes("std")) as StdQuotes;
  const records = await q.xdxr(symbol);

  try {
    writeFileSync(cachePath, JSON.stringify(records), "utf-8");
  } catch { /* ignore */ }

  return records;
}

export async function toAdjust(
  data: OhlcBar[],
  symbol: string,
  adjust: string = "qfq",
): Promise<OhlcBar[]> {
  const xdxr = await getXdXr(symbol);
  const factorData = await fqFactor(symbol, adjust);
  return doReversion(symbol, data, xdxr, adjust, factorData);
}

export async function toAdjust2(
  data: OhlcBar[],
  symbol: string,
  adjust: string = "qfq",
): Promise<OhlcBar[]> {
  if (!adjust || adjust === "bfq") return data;

  const factors = await fqFactor(symbol, adjust);
  if (factors.length === 0) return data;

  return factorReversion(data, factors, adjust);
}
