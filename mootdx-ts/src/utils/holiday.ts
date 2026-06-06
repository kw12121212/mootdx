import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createLogger } from "../logger";

const log = createLogger("holiday");

const SINA_HOLIDAY_URL = "https://finance.sina.com.cn/realstock/company/klc_td_sh.txt";
const TDX_HOLIDAY_URL = "https://www.tdx.com.cn/url/holiday/";

// Load the holiday.js decryption function at module level
const holidayJsCode = readFileSync(join(import.meta.dir, "holiday_decode.js"), "utf-8");

interface HolidayRecord {
  date: string;
  year: number;
}

interface TdxHolidayRecord {
  date: string;
  name: string;
  country: string;
  exchange: string;
}

function decryptHolidays(encrypted: string): Date[] {
  const fn = new Function("t", holidayJsCode + "\nreturn d(t);");
  const result = fn(encrypted) as { day: Date }[];
  return result.map((r) => r.day);
}

function holidayCachePath(name: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  const dir = join(home, ".mootdx", "caches");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, name);
}

export async function holidays(): Promise<HolidayRecord[]> {
  const cachePath = holidayCachePath("holidays.json");
  const CACHE_TTL = 24 * 3600 * 1000;

  if (existsSync(cachePath)) {
    try {
      const { mtimeMs } = require("node:fs").statSync(cachePath) as { mtimeMs: number };
      if (Date.now() - mtimeMs < CACHE_TTL) {
        const raw = readFileSync(cachePath, "utf-8");
        return JSON.parse(raw) as HolidayRecord[];
      }
    } catch { /* fall through */ }
  }

  try {
    const resp = await fetch(SINA_HOLIDAY_URL);
    const text = await resp.text();
    const encrypted = text.split("=")[1]?.split(";")[0]?.replace(/"/g, "") ?? "";

    const dates = decryptHolidays(encrypted);
    // Add missing date from Python code
    dates.push(new Date(1992, 4, 4));
    dates.sort((a, b) => a.getTime() - b.getTime());

    const records: HolidayRecord[] = dates.map((d) => ({
      date: d.toISOString().split("T")[0]!,
      year: d.getFullYear(),
    }));

    try {
      writeFileSync(cachePath, JSON.stringify(records), "utf-8");
    } catch { /* ignore */ }

    return records;
  } catch (err) {
    log.warn(`holidays fetch failed: ${err}`);
    if (existsSync(cachePath)) {
      try {
        unlinkSync(cachePath);
      } catch { /* ignore */ }
    }
    return [];
  }
}

export async function holiday2(date?: string): Promise<HolidayRecord[]> {
  const all = await holidays();
  if (!date) return all;

  let target: string;
  try {
    target = new Date(date).toISOString().split("T")[0]!;
  } catch {
    target = new Date().toISOString().split("T")[0]!;
  }

  return all.filter((r) => r.date === target);
}

export async function isHoliday(
  date?: string,
  format = "%Y-%m-%d",
  country = "中国",
): Promise<boolean> {
  let target: Date;
  try {
    target = date ? new Date(date) : new Date();
  } catch {
    log.warn("Invalid date or format");
    return false;
  }

  const all = await tdxHolidays();
  const targetStr = formatDate(target);
  const match = all.find((r) => r.country === country && r.date === targetStr);
  if (match) return true;

  return target.getDay() === 0 || target.getDay() === 6;
}

export async function tdxHolidays(): Promise<TdxHolidayRecord[]> {
  const cachePath = holidayCachePath("holiday.json");
  const CACHE_TTL = 24 * 3600 * 1000;

  if (existsSync(cachePath)) {
    try {
      const { mtimeMs } = require("node:fs").statSync(cachePath) as { mtimeMs: number };
      if (Date.now() - mtimeMs < CACHE_TTL) {
        const raw = readFileSync(cachePath, "utf-8");
        return JSON.parse(raw) as TdxHolidayRecord[];
      }
    } catch { /* fall through */ }
  }

  try {
    const resp = await fetch(TDX_HOLIDAY_URL);
    const text = await resp.text();
    const match = text.match(/<textarea id="data" style="display:none;">([\s\S]+?)<\/textarea>/);
    if (!match) return [];

    const lines = match[1]!.trim().split("\n");
    const records: TdxHolidayRecord[] = lines
      .map((line) => {
        const parts = line.split("|");
        if (parts.length < 4) return null;
        const dateNum = parts[0]!.trim();
        const y = dateNum.slice(0, 4);
        const m = dateNum.slice(4, 6);
        const d = dateNum.slice(6, 8);
        return {
          date: `${y}-${m}-${d}`,
          name: parts[1]!.trim(),
          country: parts[2]!.trim(),
          exchange: parts[3]!.trim(),
        };
      })
      .filter((r): r is TdxHolidayRecord => r !== null);

    try {
      writeFileSync(cachePath, JSON.stringify(records), "utf-8");
    } catch { /* ignore */ }

    return records;
  } catch (err) {
    log.warn(`tdxHolidays fetch failed: ${err}`);
    if (existsSync(cachePath)) {
      try {
        unlinkSync(cachePath);
      } catch { /* ignore */ }
    }
    return [];
  }
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
