import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { copyFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { createLogger } from "../logger";

const log = createLogger("DownloadTDXCaiWu");

const CONCURRENCY = 10;

const HASHLIST_GPCW_URL = "https://data.tdx.com.cn/tdxfin/gpcw.txt";
const HASHLIST_GPSZ_URL = "https://data.tdx.com.cn/tdxgp/gpszsh.txt";
const ONE_GPCW_URL = "https://data.tdx.com.cn/tdxfin/{filename}";
const ONE_GPSZ_URL = "https://data.tdx.com.cn/tdxgp/{filename}";

function md5File(filepath: string): string {
  const data = readFileSync(filepath);
  return createHash("md5").update(data).digest("hex");
}

async function downloadFile(url: string, saveDir: string, filename?: string): Promise<string> {
  if (!existsSync(saveDir)) mkdirSync(saveDir, { recursive: true });

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`download failed: ${resp.status} ${url}`);

  const buffer = Buffer.from(await resp.arrayBuffer());
  const name =
    filename ??
    resp.headers
      .get("content-disposition")
      ?.split("filename=")[1] ??
    url.split("/").pop() ??
    "unknown";

  const filepath = join(saveDir, name);
  writeFileSync(filepath, buffer);
  return name;
}

interface HashEntry {
  filename: string;
  hash: string;
}

function parseHashList(filepath: string): HashEntry[] {
  if (!existsSync(filepath)) return [];
  const text = readFileSync(filepath, "utf-8");
  return text
    .split("\n")
    .map((line) => {
      const parts = line.trim().split(",");
      if (parts.length < 2) return null;
      return { filename: parts[0]!, hash: parts[1]!.trim() };
    })
    .filter((e): e is HashEntry => e !== null);
}

function checkHashList(
  hashFile: string,
  checkDir: string,
  isEqual: boolean,
  scope?: string[],
): string[] {
  const entries = parseHashList(hashFile);
  const filtered = scope
    ? entries.filter((e) => scope.includes(e.filename))
    : entries;

  const mismatched: string[] = [];
  for (const entry of filtered) {
    const filepath = join(checkDir, entry.filename);
    if (!existsSync(filepath)) {
      if (!isEqual) mismatched.push(entry.filename);
      continue;
    }
    const fileMd5 = md5File(filepath);
    if (isEqual && fileMd5 === entry.hash) {
      mismatched.push(entry.filename);
    } else if (!isEqual && fileMd5 !== entry.hash) {
      mismatched.push(entry.filename);
    }
  }
  return mismatched;
}

async function downloadChunked(urls: string[], saveDir: string): Promise<void> {
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const chunk = urls.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map((url) => downloadFile(url, saveDir)));
  }
}

export class DownloadTDXCaiWu {
  private tdxRootDir: string;
  private tdxCwDir: string;
  private tmpCwDir: string;

  constructor(tdxRootDir = "new_tdx") {
    this.tdxRootDir = tdxRootDir;
    this.tdxCwDir = join(tdxRootDir, "vipdoc", "cw");
    this.tmpCwDir = "cw_tmp";
  }

  async downloadCwHashList(): Promise<void> {
    await Promise.all([
      downloadFile(HASHLIST_GPCW_URL, this.tmpCwDir, "gpcw.txt"),
      downloadFile(HASHLIST_GPSZ_URL, this.tmpCwDir, "gpszsh.txt"),
    ]);
  }

  async downloadCwItems(fileNames: string[]): Promise<void> {
    if (fileNames.length === 0) return;

    const gpcwUrls = fileNames
      .filter((f) => f.includes("gpcw"))
      .map((f) => ONE_GPCW_URL.replace("{filename}", f));
    const gpszUrls = fileNames
      .filter((f) => !f.includes("gpcw"))
      .map((f) => ONE_GPSZ_URL.replace("{filename}", f));

    if (gpcwUrls.length > 0) {
      log.info(`downloading ${gpcwUrls.length} financial data files`);
      await downloadChunked(gpcwUrls, this.tmpCwDir);
    }

    if (gpszUrls.length > 0) {
      log.info(`downloading ${gpszUrls.length} stock data files`);
      await downloadChunked(gpszUrls, this.tmpCwDir);
    }
  }

  downloadDueCw(): string[] {
    const toUpdateGpcw = checkHashList(
      join(this.tmpCwDir, "gpcw.txt"),
      this.tdxCwDir,
      false,
    );
    log.info(`financial data files to update: ${toUpdateGpcw.length}`);

    const toUpdateGpsz = checkHashList(
      join(this.tmpCwDir, "gpszsh.txt"),
      this.tdxCwDir,
      false,
    );
    log.info(`stock data files to update: ${toUpdateGpsz.length}`);

    return [...toUpdateGpcw, ...toUpdateGpsz];
  }

  copyRightCwToTdx(downloadedFiles: string[]): string[] {
    const correctGpcw = checkHashList(
      join(this.tmpCwDir, "gpcw.txt"),
      this.tmpCwDir,
      true,
      downloadedFiles,
    );
    const correctGpsz = checkHashList(
      join(this.tmpCwDir, "gpszsh.txt"),
      this.tmpCwDir,
      true,
      downloadedFiles,
    );
    const toCopy = [...correctGpcw, ...correctGpsz];

    if (toCopy.length > 0) {
      if (!existsSync(this.tdxCwDir)) mkdirSync(this.tdxCwDir, { recursive: true });
      for (const f of toCopy) {
        copyFileSync(join(this.tmpCwDir, f), join(this.tdxCwDir, f));
      }
      log.info(`copied ${toCopy.length} verified files to TDX directory`);
    }

    return toCopy;
  }

  async run(clearTempDir = false): Promise<void> {
    if (clearTempDir && existsSync(this.tmpCwDir)) {
      rmSync(this.tmpCwDir, { recursive: true });
    }

    log.info("starting TDX financial data download");
    await this.downloadCwHashList();

    const toUpdate = this.downloadDueCw();
    if (toUpdate.length === 0) {
      log.info("TDX directory is already up to date");
      return;
    }

    await this.downloadCwItems(toUpdate);

    const copied = this.copyRightCwToTdx(toUpdate);
    if (toUpdate.length === copied.length) {
      log.info("all files downloaded and verified successfully");
    } else {
      const missing = toUpdate.filter((f) => !copied.includes(f));
      log.warn(`downloaded files with errors: ${missing.join(", ")}`);
    }
  }
}
