import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { BaseFinancial, getReportFileBySize, type ReportHook } from "./base";
import { columns } from "./columns";
import { TdxBaseApi } from "../protocol/base";
import { setupCommands } from "../protocol/login";
import { createLogger } from "../logger";
import type { FinancialFile } from "../types";

const log = createLogger("financial");

// --- Financial data record ---

export type FinancialRecord = {
  code: string;
  report_date: number;
  [key: string]: string | number;
};

// --- FinancialReader ---

export class FinancialReader {
  static toData(filename: string): FinancialRecord[] {
    const buf = readFileSync(filename);
    const ext = filename.split(".").pop()?.toLowerCase();

    let datBuf: Buffer;
    if (ext === "zip") {
      datBuf = extractDatFromZip(buf);
    } else {
      datBuf = buf;
    }

    return parseFinancialDat(datBuf);
  }
}

function extractDatFromZip(zipBuf: Buffer): Buffer {
  const tmpDir = join(tmpdir(), `mootdx_${randomUUID()}`);
  mkdirSync(tmpDir, { recursive: true });

  const zipPath = join(tmpDir, "archive.zip");
  writeFileSync(zipPath, zipBuf);

  try {
    execSync(`unzip -o "${zipPath}" -d "${tmpDir}"`, { stdio: "pipe" });
  } catch {
    throw new Error("failed to extract zip archive");
  }

  const files = readdirSync(tmpDir);
  const datFile = files.find((f) => f.endsWith(".dat"));

  if (!datFile) {
    throw new Error("no .dat file found in zip archive");
  }

  const data = readFileSync(join(tmpDir, datFile));

  try {
    rmSync(tmpDir, { recursive: true });
  } catch { /* ignore */ }

  return data;
}

function parseFinancialDat(buf: Buffer): FinancialRecord[] {
  // Header: <1h I 1H 3L = 2 + 4 + 2 + 4*3 = 20 bytes
  const headerSize = 20;
  // stock item: <6s 1c 1L = 6 + 1 + 4 = 11 bytes
  const stockItemSize = 11;

  const reportDate = buf.readUInt32LE(2);
  const maxCount = buf.readUInt16LE(6);
  const reportSize = buf.readUInt32LE(12);

  const reportFieldsCount = Math.floor(reportSize / 4);

  const results: FinancialRecord[] = [];

  for (let stockIdx = 0; stockIdx < maxCount; stockIdx++) {
    const siOffset = headerSize + stockIdx * stockItemSize;
    if (siOffset + stockItemSize > buf.length) break;

    const codeBuf = buf.subarray(siOffset, siOffset + 6);
    const code = codeBuf.toString("utf-8").replace(/\0/g, "").trim();

    const dataOffset = buf.readUInt32LE(siOffset + 7);

    const infoSize = reportFieldsCount * 4;
    if (dataOffset + infoSize > buf.length) continue;

    const record: FinancialRecord = { code, report_date: reportDate };

    for (let fieldIdx = 0; fieldIdx < reportFieldsCount; fieldIdx++) {
      const val = buf.readFloatLE(dataOffset + fieldIdx * 4);
      const colName = fieldIdx < columns.length ? columns[fieldIdx]! : `col${fieldIdx}`;
      record[colName] = val;
    }

    results.push(record);
  }

  return results;
}

// --- FinancialList ---

export class FinancialList extends BaseFinancial {
  override async content(
    _downdir?: string | null,
    _reportHook?: ReportHook | null,
    _chunkSize?: number,
  ): Promise<Buffer | null> {
    let client: TdxBaseApi | null = null;
    try {
      client = new TdxBaseApi();
      await client.connect(this.bestip[0], this.bestip[1]);
      await setupCommands(client);
      const result = await getReportFileBySize(client, 0, 0, "tdxfin/gpcw.txt");
      return result.chunkdata;
    } catch (err) {
      log.error(`FinancialList.content failed: ${err}`);
      return null;
    } finally {
      client?.disconnect();
    }
  }

  override parse(downloadFile: Buffer): FinancialFile[] | null {
    const text = downloadFile.toString("utf-8").trim();
    if (!text) return null;

    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line)
      .map((line) => {
        const parts = line.split(",");
        return {
          filename: parts[0] ?? "",
          hash: parts[1] ?? "",
          filesize: Number(parts[2] ?? 0),
        };
      });
  }

  override async fetchAndParse(): Promise<FinancialFile[] | null> {
    const buf = await this.content();
    if (!buf) return null;
    return this.parse(buf);
  }
}

// --- Financial (single file download) ---

export class Financial extends BaseFinancial {
  override async content(
    downdir?: string | null,
    _reportHook?: ReportHook | null,
    _chunkSize: number = 51200,
    filename?: string,
    filesize: number = 0,
  ): Promise<Buffer | null> {
    if (!filename) {
      throw new Error("filename is required");
    }

    let client: TdxBaseApi | null = null;
    try {
      client = new TdxBaseApi();
      await client.connect(this.bestip[0], this.bestip[1]);
      await setupCommands(client);
      const result = await getReportFileBySize(client, 0, filesize, `tdxfin/${filename}`);
      const data = result.chunkdata;

      if (downdir) {
        if (!existsSync(downdir)) {
          mkdirSync(downdir, { recursive: true });
        }
        const downfile = join(downdir, filename);
        writeFileSync(downfile, data);
      }

      return data;
    } catch (err) {
      log.error(`Financial.content failed: ${err}`);
      return null;
    } finally {
      client?.disconnect();
    }
  }

  override parse(downloadFile: Buffer): FinancialRecord[] {
    return parseFinancialDat(downloadFile);
  }

  async fetchOnly(
    downdir: string,
    filename: string,
    filesize: number = 0,
    reportHook?: ReportHook | null,
  ): Promise<void> {
    await this.content(downdir, reportHook, 51200, filename, filesize);
  }

  async fetchAndParseFile(
    downdir: string,
    filename: string,
    filesize: number = 0,
  ): Promise<FinancialRecord[] | null> {
    const buf = await this.content(downdir, undefined, 51200, filename, filesize);
    if (!buf) return null;
    return this.parse(buf);
  }
}
