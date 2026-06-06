import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createLogger } from "../logger";

const log = createLogger("tdx2csv");

const COLUMNS = ["date", "open", "high", "low", "close", "vol", "amount"];

export function txt2csv(infile: string, outfile?: string): Record<string, string | number>[] {
  if (!existsSync(infile)) {
    log.warn(`input file not found: ${infile}`);
    return [];
  }

  try {
    const raw = readFileSync(infile);
    const text = new TextDecoder("gb2312" as unknown as string).decode(raw);
    const lines = text.split(/\r?\n/);

    // Skip first 2 header lines and last summary line
    const dataLines = lines.slice(2, -1);
    if (dataLines.length === 0) return [];

    const rows: Record<string, string | number>[] = [];

    for (const line of dataLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const cols = trimmed.split(/\s+/);
      if (cols.length < 7) continue;

      rows.push({
        date: cols[0]!,
        open: parseFloat(cols[1]!),
        high: parseFloat(cols[2]!),
        low: parseFloat(cols[3]!),
        close: parseFloat(cols[4]!),
        vol: parseFloat(cols[5]!),
        amount: parseFloat(cols[6]!),
      });
    }

    const out = outfile ?? infile.replace(".txt", ".csv");
    if (rows.length > 0) {
      const csvLines = [COLUMNS.join(",")];
      for (const row of rows) {
        csvLines.push(COLUMNS.map((c) => String(row[c] ?? "")).join(","));
      }
      writeFileSync(out, csvLines.join("\n"), "utf-8");
    }

    return rows;
  } catch (err) {
    log.warn(`parse error for ${infile}: ${err}`);
    return [];
  }
}

export async function batch(src: string, _dst?: string): Promise<void> {
  if (!existsSync(src)) {
    log.warn(`source directory not found: ${src}`);
    return;
  }

  const files = readdirSync(src).filter((f) => f.endsWith(".txt"));
  const tasks = files.map((f) => {
    const srcPath = join(src, f);
    const dstPath = srcPath.replace(".txt", ".csv");
    return Promise.resolve(txt2csv(srcPath, dstPath));
  });

  await Promise.all(tasks);
}
