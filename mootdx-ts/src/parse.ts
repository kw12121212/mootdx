import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TYPE_FLATS, TYPE_GROUP } from "./consts";
import { decodeGBK } from "./utils";

// --- Block data types ---

export type BlockRecord = {
  blockname: string;
  block_type: number;
  code: string;
  code_index: number;
};

export type BlockGroup = {
  blockname: string;
  block_type: number;
  stock_count: number;
  code_list: string;
};

export type InconData = Record<string, Record<string, string>>;

// --- Local .dat binary block parser ---

function parseBlockDat(buf: Buffer, mode: typeof TYPE_FLATS | typeof TYPE_GROUP): BlockRecord[] | BlockGroup[] {
  const blockCount = buf.readUInt16LE(384);
  let pos = 386;

  if (mode === TYPE_GROUP) {
    const groups: BlockGroup[] = [];
    for (let i = 0; i < blockCount; i++) {
      const nameBuf = buf.subarray(pos, pos + 9);
      const blockname = decodeGBK(nameBuf).replace(/\0/g, "").trim();
      pos += 9;

      const stockCount = buf.readUInt16LE(pos);
      const blockType = buf.readUInt16LE(pos + 2);
      pos += 4;

      const codes: string[] = [];
      for (let j = 0; j < stockCount; j++) {
        const codeBuf = buf.subarray(pos, pos + 7);
        codes.push(decodeGBK(codeBuf).replace(/\0/g, "").trim());
        pos += 7;
      }
      // Each block's stock area is padded to 2800 bytes
      const usedStockBytes = stockCount * 7;
      const padding = 2800 - usedStockBytes;
      pos += padding;

      groups.push({
        blockname,
        block_type: blockType,
        stock_count: stockCount,
        code_list: codes.join(","),
      });
    }
    return groups;
  }

  // TYPE_FLATS mode
  const flats: BlockRecord[] = [];
  for (let i = 0; i < blockCount; i++) {
    const nameBuf = buf.subarray(pos, pos + 9);
    const blockname = decodeGBK(nameBuf).replace(/\0/g, "").trim();
    pos += 9;

    const stockCount = buf.readUInt16LE(pos);
    const blockType = buf.readUInt16LE(pos + 2);
    pos += 4;

    for (let j = 0; j < stockCount; j++) {
      const codeBuf = buf.subarray(pos, pos + 7);
      const code = decodeGBK(codeBuf).replace(/\0/g, "").trim();
      pos += 7;
      flats.push({
        blockname,
        block_type: blockType,
        code,
        code_index: j,
      });
    }
    const usedStockBytes = stockCount * 7;
    const padding = 2800 - usedStockBytes;
    pos += padding;
  }
  return flats;
}

// --- BaseParse class ---

export class BaseParse {
  protected tdxdir: string;

  constructor(tdxdir: string) {
    this.tdxdir = tdxdir;
  }

  parse(symbol?: string | null, group: boolean = false): BlockRecord[] | BlockGroup[] | InconData | string[][] | null {
    if (!symbol) return null;

    const hasSuffix = /\.[^.]+$/.test(symbol);
    const suffix = hasSuffix ? "" : ".dat";
    const stem = symbol.replace(/\.[^.]+$/, "");

    let subdir: string;
    if (stem.includes("incon")) {
      subdir = "";
    } else {
      subdir = "T0002/hq_cache";
    }

    const filename = `${stem}${suffix}`;
    const filepath = join(this.tdxdir, subdir, filename);

    if (!existsSync(filepath)) {
      return null;
    }

    if (stem.includes("incon")) {
      return this.readIncon(filepath);
    }

    if (stem.startsWith("block_") && (hasSuffix || suffix === ".dat")) {
      const buf = readFileSync(filepath);
      const mode = group ? TYPE_GROUP : TYPE_FLATS;
      return parseBlockDat(buf, mode);
    }

    return this.readCfg(filepath);
  }

  protected readText(filepath: string): string {
    const buf = readFileSync(filepath);
    return decodeGBK(buf).trim();
  }

  protected readIncon(filepath: string): InconData {
    const text = this.readText(filepath);
    const sections = text.split("######");
    const result: InconData = {};

    for (const section of sections) {
      const lines = section.split(/\s+/).filter((l) => l.trim());
      if (lines.length === 0) continue;

      const key = lines[0]!.trim();
      const entries: Record<string, string> = {};

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i]!.split("|");
        if (parts.length === 2) {
          entries[parts[0]!.trim()] = parts[1]!.trim();
        }
      }
      result[key] = entries;
    }
    return result;
  }

  protected readCfg(filepath: string): string[][] {
    const text = this.readText(filepath);
    const lines = text.split(/\s+/).filter((l) => l.trim());
    return lines.map((line) => line.split("|"));
  }
}
