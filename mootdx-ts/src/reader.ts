import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { get_stock_market } from "./utils";
import { BaseParse, type BlockRecord, type BlockGroup, type InconData } from "./parse";
import { Customize, type CustomerBlockRecord, type CustomerBlockGroup } from "./tools/customize";
import type { OhlcBar } from "./types";

// --- Security type detection and coefficients ---

type SecurityType =
  | "SH_A_STOCK" | "SH_B_STOCK" | "SH_INDEX" | "SH_FUND" | "SH_BOND"
  | "SZ_A_STOCK" | "SZ_B_STOCK" | "SZ_INDEX" | "SZ_FUND" | "SZ_BOND"
  | "UNKNOWN";

const SECURITY_COEFFICIENT: Record<SecurityType, [number, number]> = {
  SH_A_STOCK: [0.01, 0.01],
  SH_B_STOCK: [0.001, 0.01],
  SH_INDEX: [0.01, 1.0],
  SH_FUND: [0.001, 1.0],
  SH_BOND: [0.001, 1.0],
  SZ_A_STOCK: [0.01, 0.01],
  SZ_B_STOCK: [0.01, 0.01],
  SZ_INDEX: [0.01, 1.0],
  SZ_FUND: [0.001, 0.01],
  SZ_BOND: [0.001, 0.01],
  UNKNOWN: [0.01, 0.01],
};

function getSecurityType(filename: string): SecurityType {
  const basename = filename.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "");
  const exchange = basename.slice(0, 2).toLowerCase();
  const codeHead = basename.slice(2, 4);

  if (exchange === "sz") {
    if (["00", "30"].includes(codeHead)) return "SZ_A_STOCK";
    if (codeHead === "20") return "SZ_B_STOCK";
    if (codeHead === "39") return "SZ_INDEX";
    if (["15", "16"].includes(codeHead)) return "SZ_FUND";
    if (["10", "11", "12", "13", "14"].includes(codeHead)) return "SZ_BOND";
  }
  if (exchange === "sh") {
    if (["60", "68"].includes(codeHead)) return "SH_A_STOCK";
    if (codeHead === "90") return "SH_B_STOCK";
    if (["00", "88", "99"].includes(codeHead)) return "SH_INDEX";
    if (["50", "51"].includes(codeHead)) return "SH_FUND";
    if (["01", "10", "11", "12", "13", "14", "20"].includes(codeHead)) return "SH_BOND";
  }
  return "UNKNOWN";
}

// --- Packed date/time parsing ---

function parsePackedDate(num: number): [number, number, number] {
  const month = ((num % 2048) / 100) | 0;
  const year = (num / 2048 | 0) + 2004;
  const day = (num % 2048) % 100;
  return [year, month, day];
}

function parsePackedTime(num: number): [number, number] {
  return [(num / 60) | 0, num % 60];
}

// --- Binary format parsers ---

export function parseDailyBars(buf: Buffer, filename: string): OhlcBar[] {
  const secType = getSecurityType(filename);
  const coeff = SECURITY_COEFFICIENT[secType];
  const recordSize = 32;
  const results: OhlcBar[] = [];

  for (let offset = 0; offset + recordSize <= buf.length; offset += recordSize) {
    const rawDate = buf.readUInt32LE(offset);
    const rawOpen = buf.readUInt32LE(offset + 4);
    const rawHigh = buf.readUInt32LE(offset + 8);
    const rawLow = buf.readUInt32LE(offset + 12);
    const rawClose = buf.readUInt32LE(offset + 16);
    const amount = buf.readFloatLE(offset + 20);
    const rawVol = buf.readUInt32LE(offset + 24);
    // offset + 28: reserved U32

    const dateStr = String(rawDate);
    const formatted = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

    results.push({
      date: formatted,
      open: rawOpen * coeff[0],
      high: rawHigh * coeff[0],
      low: rawLow * coeff[0],
      close: rawClose * coeff[0],
      vol: rawVol * coeff[1],
      amount,
    });
  }

  return results;
}

export function parseLCMinuteBars(buf: Buffer): OhlcBar[] {
  const recordSize = 32;
  const results: OhlcBar[] = [];

  for (let offset = 0; offset + recordSize <= buf.length; offset += recordSize) {
    const packedDate = buf.readUInt16LE(offset);
    const packedTime = buf.readUInt16LE(offset + 2);
    const open = buf.readFloatLE(offset + 4);
    const high = buf.readFloatLE(offset + 8);
    const low = buf.readFloatLE(offset + 12);
    const close = buf.readFloatLE(offset + 16);
    const amount = buf.readFloatLE(offset + 20);
    const vol = buf.readUInt32LE(offset + 24);
    // offset + 28: reserved U32

    const [year, month, day] = parsePackedDate(packedDate);
    const [hour, minute] = parsePackedTime(packedTime);

    results.push({
      date: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      open,
      high,
      low,
      close,
      vol,
      amount,
    });
  }

  return results;
}

export function parseMinuteBars(buf: Buffer): OhlcBar[] {
  const recordSize = 32;
  const results: OhlcBar[] = [];

  for (let offset = 0; offset + recordSize <= buf.length; offset += recordSize) {
    const packedDate = buf.readUInt16LE(offset);
    const packedTime = buf.readUInt16LE(offset + 2);
    const rawOpen = buf.readUInt32LE(offset + 4);
    const rawHigh = buf.readUInt32LE(offset + 8);
    const rawLow = buf.readUInt32LE(offset + 12);
    const rawClose = buf.readUInt32LE(offset + 16);
    const amount = buf.readFloatLE(offset + 20);
    const vol = buf.readUInt32LE(offset + 24);
    // offset + 28: reserved U32

    const [year, month, day] = parsePackedDate(packedDate);
    const [hour, minute] = parsePackedTime(packedTime);

    results.push({
      date: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      open: rawOpen / 100,
      high: rawHigh / 100,
      low: rawLow / 100,
      close: rawClose / 100,
      vol,
      amount,
    });
  }

  return results;
}

export function parseExDailyBars(buf: Buffer): OhlcBar[] {
  const recordSize = 32;
  const results: OhlcBar[] = [];

  for (let offset = 0; offset + recordSize <= buf.length; offset += recordSize) {
    const rawDate = buf.readUInt32LE(offset);
    const open = buf.readFloatLE(offset + 4);
    const high = buf.readFloatLE(offset + 8);
    const low = buf.readFloatLE(offset + 12);
    const close = buf.readFloatLE(offset + 16);
    const amount = buf.readUInt32LE(offset + 20);
    const vol = buf.readUInt32LE(offset + 24);
    // offset + 28: jiesuan F32

    const dateStr = String(rawDate);
    const formatted = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

    results.push({
      date: formatted,
      open,
      high,
      low,
      close,
      vol,
      amount,
    });
  }

  return results;
}

// --- Reader classes ---

export abstract class ReaderBase {
  protected tdxdir: string;

  constructor(tdxdir: string) {
    if (!existsSync(tdxdir)) {
      throw new Error(`tdxdir does not exist: ${tdxdir}`);
    }
    this.tdxdir = tdxdir;
  }

  protected findPath(
    symbol: string,
    subdir: string,
    suffix: string,
  ): string | null {
    let market: string;

    if (symbol.includes("#")) {
      market = "ds";
    } else {
      const code = symbol.replace(/^(sh|sz|bj)/i, "");
      if (code.startsWith("88")) {
        market = "sh";
      } else {
        const m = get_stock_market(symbol, true) as string;
        market = m;
      }
    }

    const code = symbol.replace(/^(sh|sz|bj)/i, "").replace(/^.*#/, "");
    const filepath = join(this.tdxdir, "vipdoc", market, subdir, `${market}${code}.${suffix}`);

    if (existsSync(filepath)) {
      return filepath;
    }
    return null;
  }

  protected readFile(path: string): Buffer {
    return readFileSync(path);
  }
}

export class StdReader extends ReaderBase {
  daily(symbol: string): OhlcBar[] | null {
    const path = this.findPath(symbol, "lday", "day");
    if (!path) return null;
    const buf = this.readFile(path);
    return parseDailyBars(buf, path);
  }

  block(symbol: string, group: boolean = false): BlockRecord[] | BlockGroup[] | InconData | string[][] | null {
    const parser = new BaseParse(this.tdxdir);
    return parser.parse(symbol, group);
  }

  block_new(name: string, symbol: string[], group: boolean = false): string[] | CustomerBlockRecord[] | CustomerBlockGroup[] | null {
    const customize = new Customize(this.tdxdir);
    return customize.search(name, group);
  }

  minute(symbol: string, suffix: 1 | 5 = 1): OhlcBar[] | null {
    if (suffix === 1) {
      // Try .lc1 first, then .1
      let path = this.findPath(symbol, "minline", "lc1");
      if (path) {
        const buf = this.readFile(path);
        return parseLCMinuteBars(buf);
      }
      path = this.findPath(symbol, "minline", "1");
      if (path) {
        const buf = this.readFile(path);
        return parseMinuteBars(buf);
      }
      return null;
    }
    // suffix === 5
    let path = this.findPath(symbol, "fzline", "lc5");
    if (path) {
      const buf = this.readFile(path);
      return parseLCMinuteBars(buf);
    }
    path = this.findPath(symbol, "fzline", "5");
    if (path) {
      const buf = this.readFile(path);
      return parseMinuteBars(buf);
    }
    return null;
  }

  fzline(symbol: string): OhlcBar[] | null {
    return this.minute(symbol, 5);
  }
}

export class ExtReader extends ReaderBase {
  daily(symbol: string): OhlcBar[] | null {
    const path = this.findPath(symbol, "lday", "day");
    if (!path) return null;
    const buf = this.readFile(path);
    return parseExDailyBars(buf);
  }

  minute(symbol: string, suffix: 1 | 5 = 1): OhlcBar[] | null {
    if (suffix === 1) {
      let path = this.findPath(symbol, "minline", "lc1");
      if (path) {
        const buf = this.readFile(path);
        return parseLCMinuteBars(buf);
      }
      path = this.findPath(symbol, "minline", "1");
      if (path) {
        const buf = this.readFile(path);
        return parseMinuteBars(buf);
      }
      return null;
    }
    let path = this.findPath(symbol, "fzline", "lc5");
    if (path) {
      const buf = this.readFile(path);
      return parseLCMinuteBars(buf);
    }
    path = this.findPath(symbol, "fzline", "5");
    if (path) {
      const buf = this.readFile(path);
      return parseMinuteBars(buf);
    }
    return null;
  }

  fzline(symbol: string): OhlcBar[] | null {
    return this.minute(symbol, 5);
  }
}

export function reader(
  market: "std" | "ext" = "std",
  tdxdir: string,
): StdReader | ExtReader {
  if (market === "ext") {
    return new ExtReader(tdxdir);
  }
  return new StdReader(tdxdir);
}
