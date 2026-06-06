import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { decodeGBK, get_stock_market } from "../utils";

// --- Customer block types ---

export type CustomerBlockRecord = {
  blockname: string;
  block_type: string;
  code: string;
  code_index: number;
};

export type CustomerBlockGroup = {
  blockname: string;
  block_type: string;
  stock_count: number;
  code_list: string;
};

// --- Helpers ---

function readBlkFile(filepath: string): string[] {
  const buf = readFileSync(filepath);
  const text = decodeGBK(buf);
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((code) => code.slice(1));
}

function readCustomerBlocks(
  dirpath: string,
  mode: "flat" | "group",
): CustomerBlockRecord[] | CustomerBlockGroup[] {
  const cfgPath = join(dirpath, "blocknew.cfg");
  if (!existsSync(cfgPath)) return [];

  const cfgBuf = readFileSync(cfgPath);
  const entries: Array<{ name: string; blkFile: string }> = [];

  for (let offset = 0; offset + 120 <= cfgBuf.length; offset += 120) {
    const nameBuf = cfgBuf.subarray(offset, offset + 50);
    const blkBuf = cfgBuf.subarray(offset + 50, offset + 120);
    const name = decodeGBK(nameBuf).replace(/\0/g, "").trim();
    const blkFile = decodeGBK(blkBuf).replace(/\0/g, "").trim();
    if (name || blkFile) {
      entries.push({ name, blkFile });
    }
  }

  if (mode === "flat") {
    const records: CustomerBlockRecord[] = [];
    for (const entry of entries) {
      const blkPath = join(dirpath, `${entry.blkFile}.blk`);
      if (!existsSync(blkPath)) continue;
      const codes = readBlkFile(blkPath);
      codes.forEach((code, idx) => {
        records.push({
          blockname: entry.name,
          block_type: entry.blkFile,
          code,
          code_index: idx,
        });
      });
    }
    return records;
  }

  const groups: CustomerBlockGroup[] = [];
  for (const entry of entries) {
    const blkPath = join(dirpath, `${entry.blkFile}.blk`);
    if (!existsSync(blkPath)) continue;
    const codes = readBlkFile(blkPath);
    groups.push({
      blockname: entry.name,
      block_type: entry.blkFile,
      stock_count: codes.length,
      code_list: codes.join(","),
    });
  }
  return groups;
}

// --- blocknew helper (create new custom block) ---

function blocknew(
  tdxdir: string,
  name: string,
  symbol: string[],
  blkFile?: string,
): boolean {
  if (!tdxdir) return false;

  if (!name) {
    name = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
  }

  blkFile = blkFile ?? String(Date.now());

  const vipdoc = join(tdxdir, "T0002", "blocknew");
  symbol = [...new Set(symbol)];

  if (!existsSync(vipdoc)) {
    mkdirSync(vipdoc, { recursive: true });
  }

  const cfgPath = join(vipdoc, "blocknew.cfg");

  if (!existsSync(cfgPath)) {
    writeFileSync(cfgPath, Buffer.alloc(0));
  } else {
    const cfgBuf = readFileSync(cfgPath);
    const cfgText = decodeGBK(cfgBuf);
    const parts = cfgText.split("\x00").filter((x) => x !== "");
    const names = parts.filter((_, i) => i % 2 === 0);
    if (names.includes(name)) {
      throw new Error("block name already exists: " + name);
    }
  }

  const content = symbol.map((s) => `${get_stock_market(s)}${s}`).join("\n");
  const encoder = new TextEncoder();
  writeFileSync(join(vipdoc, `${blkFile}.blk`), encoder.encode(content));

  const nameBytes = new TextEncoder().encode(name);
  const blkBytes = new TextEncoder().encode(blkFile);
  const nameEntry = Buffer.concat([nameBytes, Buffer.alloc(Math.max(0, 50 - nameBytes.length))]);
  const typeEntry = Buffer.concat([blkBytes, Buffer.alloc(Math.max(0, 70 - blkBytes.length))]);

  const existing = existsSync(cfgPath) ? readFileSync(cfgPath) : Buffer.alloc(0);
  writeFileSync(cfgPath, Buffer.concat([existing, nameEntry, typeEntry]));

  return true;
}

// --- Customize class ---

export class Customize {
  protected vipdoc: string;
  protected tdxdir: string;

  constructor(tdxdir: string) {
    this.tdxdir = tdxdir;
    this.vipdoc = join(tdxdir, "T0002", "blocknew");
  }

  create(name: string, symbol: string[]): boolean {
    return blocknew(this.tdxdir, name, symbol);
  }

  remove(name: string): boolean {
    const blockData = this.search() as CustomerBlockRecord[] | null;
    if (!blockData || blockData.length === 0) return false;

    const blockTemp = blockData.filter((r) => r.blockname === name);
    if (blockTemp.length === 0) return false;

    const blockTypes = [...new Set(blockTemp.map((r) => r.block_type))];
    for (const bt of blockTypes) {
      const blkPath = join(this.vipdoc, `${bt}.blk`);
      if (existsSync(blkPath)) {
        unlinkSync(blkPath);
      }
    }

    const cfgPath = join(this.vipdoc, "blocknew.cfg");
    if (!existsSync(cfgPath)) return true;

    const cfgBuf = readFileSync(cfgPath);
    const cfgText = decodeGBK(cfgBuf);

    const blockType = blockTypes[0] ?? "";
    const nameBytes = new TextEncoder().encode(name);
    const typeBytes = new TextEncoder().encode(blockType);
    const nameEntry = Buffer.concat([nameBytes, Buffer.alloc(Math.max(0, 50 - nameBytes.length))]);
    const typeEntry = Buffer.concat([typeBytes, Buffer.alloc(Math.max(0, 70 - typeBytes.length))]);
    const searchBuf = Buffer.concat([nameEntry, typeEntry]);

    const cfgStr = cfgText.replace(decodeGBK(searchBuf), "");
    writeFileSync(cfgPath, new TextEncoder().encode(cfgStr));

    return true;
  }

  search(name?: string | null, group: boolean = false): CustomerBlockRecord[] | CustomerBlockGroup[] | string[] | null {
    const mode = group ? "group" : "flat";

    if (name) {
      const result = readCustomerBlocks(this.vipdoc, "group") as CustomerBlockGroup[];
      const found = result.filter((r) => r.blockname === name);
      if (found.length === 0) return null;

      const codeList = found[0]!.code_list;
      return [...new Set(codeList.split(","))];
    }

    return readCustomerBlocks(this.vipdoc, mode as "flat");
  }

  update(name: string, symbol: string[], overflow: boolean = false): boolean {
    if (!name) return false;

    const blockPath = this.vipdoc;
    let blockCode = [...symbol];

    const blockData = this.search() as CustomerBlockRecord[] | null;
    if (!blockData || blockData.length === 0) {
      return blocknew(this.tdxdir, name, [...new Set(symbol)]);
    }

    const blockTemp = blockData.filter((r) => r.blockname === name);

    if (blockTemp.length === 0) {
      return blocknew(this.tdxdir, name, [...new Set(symbol)]);
    }

    if (!overflow) {
      blockCode = [...blockCode, ...blockTemp.map((r) => r.code)];
    }

    const blockTypes = [...new Set(blockTemp.map((r) => r.block_type))];
    const blockType = blockTypes[0] ?? String(Date.now());

    blockCode = [...new Set(blockCode)];

    const content = blockCode.map((s) => `${get_stock_market(s)}${s}`).join("\n");
    const blkPath = join(blockPath, `${blockType}.blk`);

    const encoder = new TextEncoder();
    writeFileSync(blkPath, encoder.encode(content));

    return true;
  }
}
