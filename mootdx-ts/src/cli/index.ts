#!/usr/bin/env node
import { Command } from "commander";
import { quotes as createQuotes } from "../quotes";
import { reader as createReader, StdReader, ExtReader } from "../reader";
import { bestip } from "../server";
import { Affair } from "../affair";
import { to_file, get_config_path } from "../utils";
import { createLogger } from "../logger";
import type { OhlcBar } from "../types";
import { join } from "node:path";
import { writeFileSync } from "node:fs";

const log = createLogger("cli");

const FREQUENCY_MAP: Record<string, number> = {
  daily: 9,
  bars: 9,
  minute: 8,
  fzline: 0,
  "1m": 8,
  "5m": 0,
  "15m": 1,
  "30m": 2,
  "1h": 3,
  week: 5,
  mon: 6,
};

async function getBars(
  market: string,
  symbol: string,
  action: string,
): Promise<OhlcBar[]> {
  const q = await createQuotes(market as "std" | "ext");
  const freq = FREQUENCY_MAP[action] ?? 9;
  if ("bars" in q) {
    return (q as { bars: (symbol: string, frequency: string | number) => Promise<OhlcBar[]> }).bars(symbol, freq);
  }
  return [];
}

const program = new Command();

program
  .name("mootdx")
  .description("TDX stock market data CLI")
  .version("0.1.0")
  .option("--verbose", "Enable debug logging", false);

// --- quotes command ---
program
  .command("quotes")
  .description("Read online stock quotes")
  .option("-s, --symbol <symbol>", "Stock symbol", "600000")
  .option("-a, --action <action>", "Action type (daily, minute, fzline, bars)", "bars")
  .option("-m, --market <market>", "Market (std or ext)", "std")
  .option("-o, --output <file>", "Output file (csv or json)")
  .action(async (opts) => {
    try {
      const data = await getBars(opts.market, opts.symbol, opts.action);
      if (opts.output) {
        to_file(data as unknown as Record<string, unknown>[], opts.output);
      } else {
        console.table(data.slice(0, 20));
      }
    } catch (err) {
      log.error(`quotes failed: ${err}`);
      process.exit(1);
    }
  });

// --- reader command ---
program
  .command("reader")
  .description("Read local stock data files")
  .option("-d, --tdxdir <path>", "TDX data directory", "C:/new_tdx")
  .option("-s, --symbol <symbol>", "Stock symbol", "600000")
  .option("-a, --action <action>", "Action (daily, minute, fzline, block, block_new)", "daily")
  .option("-m, --market <market>", "Market (std or ext)", "std")
  .option("-o, --output <file>", "Output file (csv or json)")
  .action(async (opts) => {
    try {
      const r = await createReader(opts.market as "std" | "ext", opts.tdxdir);
      const action = opts.action === "fzline" ? "minute" : opts.action;
      let data: unknown;

      if (r instanceof StdReader) {
        if (action === "daily") {
          data = r.daily(opts.symbol);
        } else if (action === "minute") {
          data = r.minute(opts.symbol, 1);
        } else if (action === "block") {
          data = r.block(opts.symbol);
        } else if (action === "block_new") {
          data = r.block_new("自选股", [opts.symbol]);
        } else {
          data = r.daily(opts.symbol);
        }
      } else if (r instanceof ExtReader) {
        if (action === "daily") {
          data = r.daily(opts.symbol);
        } else if (action === "minute") {
          data = r.minute(opts.symbol, 1);
        } else {
          data = r.daily(opts.symbol);
        }
      }

      if (opts.output) {
        to_file(data as Record<string, unknown>[], opts.output);
      } else {
        if (Array.isArray(data)) {
          console.table(data.slice(0, 20));
        } else {
          console.log(data);
        }
      }
    } catch (err) {
      log.error(`reader failed: ${err}`);
      process.exit(1);
    }
  });

// --- bestip command ---
program
  .command("bestip")
  .description("Test and find fastest quote server")
  .option("-l, --limit <n>", "Show top N fastest servers", "5")
  .option("-v, --verbose", "Verbose mode")
  .action(async (opts) => {
    try {
      const limit = parseInt(opts.limit, 10) || 5;
      await bestip(limit);
      const configPath = get_config_path("config.json");
      log.info(`Best IP saved to ${configPath}`);
    } catch (err) {
      log.error(`bestip failed: ${err}`);
      process.exit(1);
    }
  });

// --- affair command ---
program
  .command("affair")
  .description("Download and parse financial report files")
  .option("-p, --parse <filename>", "Parse a specific file")
  .option("-f, --fetch <filename>", "Download a specific file")
  .option("-a, --downall", "Download all files")
  .option("-o, --output <file>", "Output file (csv or json)")
  .option("-d, --downdir <dir>", "Download directory", "output")
  .option("-l, --listfile", "List all available files")
  .option("-v, --verbose", "Verbose mode")
  .action(async (opts) => {
    try {
      const files = await Affair.files();

      if (!files) {
        log.warn("No files found");
        return;
      }

      if (opts.listfile) {
        console.table(files.map((f) => ({ filename: f.filename, filesize: f.filesize, hash: f.hash })));
        return;
      }

      if (opts.downall || opts.fetch === "all") {
        await Affair.fetch(opts.downdir);
        return;
      }

      if (opts.fetch) {
        const fname = opts.fetch.replace(/\.zip$/, "") + ".zip";
        await Affair.fetch(opts.downdir, fname);
        return;
      }

      if (opts.parse) {
        const fname = opts.parse.replace(/\.zip$/, "") + ".zip";
        const filenames = files.map((f) => f.filename);

        if (filenames.includes(fname)) {
          const data = await Affair.parse(opts.downdir, fname);
          if (data) {
            if (opts.output) {
              to_file(data as unknown as Record<string, unknown>[], opts.output);
            } else {
              console.table(data.slice(0, 20));
            }
          }
        } else {
          log.error(`File not found: ${fname}`);
        }
      }
    } catch (err) {
      log.error(`affair failed: ${err}`);
      process.exit(1);
    }
  });

// --- bundle command ---
program
  .command("bundle")
  .description("Batch download quote data")
  .option("-o, --output <dir>", "Output directory", "bundle")
  .option("-s, --symbol <symbols>", "Stock symbols (comma-separated)", "600000")
  .option("-a, --action <action>", "Action type (daily, minute, fzline, bars)", "bars")
  .option("-m, --market <market>", "Market (std or ext)", "std")
  .option("-e, --extension <ext>", "File extension", "csv")
  .action(async (opts) => {
    try {
      const symbols = opts.symbol.replace(/，/g, ",").split(",").map((s: string) => s.trim());
      const q = await createQuotes(opts.market as "std" | "ext");
      const freq = FREQUENCY_MAP[opts.action] ?? 9;

      for (const code of symbols) {
        const data = "bars" in q
          ? await (q as { bars: (s: string, f: string | number) => Promise<OhlcBar[]> }).bars(code, freq)
          : [];
        const outPath = join(opts.output, `${code}.${opts.extension}`);

        if (opts.extension === "json") {
          writeFileSync(outPath, JSON.stringify(data, null, 2), "utf-8");
        } else {
          to_file(data as unknown as Record<string, unknown>[], outPath);
        }
        console.log(`Downloaded ${code}`);
      }

      console.log(`Files saved to "${opts.output}"`);
    } catch (err) {
      log.error(`bundle failed: ${err}`);
      process.exit(1);
    }
  });

program.parse();
