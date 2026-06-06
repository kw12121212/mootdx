import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FinancialList, Financial, FinancialReader, type FinancialRecord } from "./financial/financial";
import { createLogger } from "./logger";
import type { FinancialFile } from "./types";

const log = createLogger("affair");

async function fetchFile(downdir: string, fileObj: FinancialFile): Promise<void> {
  const filepath = join(downdir, fileObj.filename);

  if (existsSync(filepath)) {
    const hash = createHash("md5").update(readFileSync(filepath)).digest("hex");
    if (hash === fileObj.hash) {
      log.warn(`file already exists: ${filepath}`);
      return;
    }
  }

  const crawler = new Financial();
  await crawler.fetchOnly(downdir, fileObj.filename, fileObj.filesize);
}

export class Affair {
  static async files(): Promise<FinancialFile[] | null> {
    const list = new FinancialList();
    return list.fetchAndParse();
  }

  static async fetch(downdir: string = ".", filename?: string): Promise<boolean | void> {
    if (!existsSync(downdir)) {
      log.warn("download directory does not exist, creating");
      mkdirSync(downdir, { recursive: true });
    }

    if (filename) {
      log.debug(`downloading file ${filename}`);
      const crawler = new Financial();
      await crawler.fetchOnly(downdir, filename);
      return true;
    }

    const list = new FinancialList();
    const files = await list.fetchAndParse();
    if (!files || files.length === 0) {
      log.warn("no files found for batch download");
      return;
    }

    await Promise.all(files.map((f) => fetchFile(downdir, f)));
  }

  static async parse(downdir: string = ".", filename?: string | null): Promise<FinancialRecord[] | null> {
    if (!filename) {
      log.error("filename is required");
      return null;
    }

    const filepath = join(downdir, filename);

    if (!existsSync(filepath)) {
      await Affair.fetch(downdir, filename);
    }

    if (existsSync(filepath)) {
      return FinancialReader.toData(filepath);
    }

    log.warn(`file not found: ${filename}`);
    return null;
  }
}
