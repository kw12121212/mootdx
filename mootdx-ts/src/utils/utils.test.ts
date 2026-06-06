import { test, describe, expect, afterAll } from "bun:test";
import { get_stock_market, get_stock_markets, get_frequency, md5sum, get_config_path } from "./index";
import { MARKET_SH, MARKET_SZ, MARKET_BJ } from "../consts";
import { existsSync, writeFileSync, unlinkSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

// --- get_stock_market ---

describe("get_stock_market", () => {
  test("returns SH (number) for 6xx codes", () => {
    expect(get_stock_market("600000")).toBe(MARKET_SH);
  });

  test("returns SH (number) for 50x codes", () => {
    expect(get_stock_market("500001")).toBe(MARKET_SH);
  });

  test("returns SH (number) for 68x codes", () => {
    expect(get_stock_market("688001")).toBe(MARKET_SH);
  });

  test("returns SZ (number) for 0xx codes", () => {
    expect(get_stock_market("000001")).toBe(MARKET_SZ);
  });

  test("returns SZ (number) for 30x codes", () => {
    expect(get_stock_market("300001")).toBe(MARKET_SZ);
  });

  test("returns SZ (number) for 002 codes", () => {
    expect(get_stock_market("002001")).toBe(MARKET_SZ);
  });

  test("returns BJ (number) for 4xx codes", () => {
    expect(get_stock_market("400001")).toBe(MARKET_BJ);
  });

  test("returns BJ (number) for 8xx codes", () => {
    expect(get_stock_market("800001")).toBe(MARKET_BJ);
  });

  // Prefix-based detection
  test("returns SH for sh prefix", () => {
    expect(get_stock_market("sh600000")).toBe(MARKET_SH);
    expect(get_stock_market("SH600000")).toBe(MARKET_SH);
  });

  test("returns SZ for sz prefix", () => {
    expect(get_stock_market("sz000001")).toBe(MARKET_SZ);
    expect(get_stock_market("SZ000001")).toBe(MARKET_SZ);
  });

  test("returns BJ for bj prefix", () => {
    expect(get_stock_market("bj400001")).toBe(MARKET_BJ);
    expect(get_stock_market("BJ400001")).toBe(MARKET_BJ);
  });

  // String output
  test("returns string 'sh' when asString=true for SH", () => {
    expect(get_stock_market("600000", true)).toBe("sh");
    expect(get_stock_market("sh600000", true)).toBe("sh");
  });

  test("returns string 'sz' when asString=true for SZ", () => {
    expect(get_stock_market("000001", true)).toBe("sz");
    expect(get_stock_market("sz000001", true)).toBe("sz");
  });

  test("returns string 'bj' when asString=true for BJ", () => {
    expect(get_stock_market("400001", true)).toBe("bj");
    expect(get_stock_market("bj400001", true)).toBe("bj");
  });

  test("defaults to SZ for unrecognized codes", () => {
    expect(get_stock_market("999999")).toBe(MARKET_SZ);
    expect(get_stock_market("999999", true)).toBe("sz");
  });
});

// --- get_stock_markets ---

describe("get_stock_markets", () => {
  test("returns market and code for multiple symbols", () => {
    const result = get_stock_markets(["sh600000", "sz000001", "bj400001"]);
    expect(result.length).toBe(3);
    expect(result[0]).toEqual([MARKET_SH, "600000"]);
    expect(result[1]).toEqual([MARKET_SZ, "000001"]);
    expect(result[2]).toEqual([MARKET_BJ, "400001"]);
  });

  test("returns market and code for codes without prefix", () => {
    const result = get_stock_markets(["600000", "000001"]);
    expect(result[0]).toEqual([MARKET_SH, "600000"]);
    expect(result[1]).toEqual([MARKET_SZ, "000001"]);
  });

  test("returns empty array for empty input", () => {
    expect(get_stock_markets([])).toEqual([]);
  });

  test("strips prefix from code in result", () => {
    const result = get_stock_markets(["sh600000"]);
    expect(result[0]![1]).toBe("600000");
  });
});

// --- get_frequency ---

describe("get_frequency", () => {
  test("returns index of known frequency strings", () => {
    expect(get_frequency("5m")).toBe(0);
    expect(get_frequency("15m")).toBe(1);
    expect(get_frequency("30m")).toBe(2);
    expect(get_frequency("1h")).toBe(3);
    expect(get_frequency("day")).toBe(4);
    expect(get_frequency("week")).toBe(5);
    expect(get_frequency("mon")).toBe(6);
    expect(get_frequency("ex_1m")).toBe(7);
    expect(get_frequency("1m")).toBe(8);
    expect(get_frequency("dk")).toBe(9);
    expect(get_frequency("3mon")).toBe(10);
    expect(get_frequency("year")).toBe(11);
  });

  test("returns 0 for unknown frequency strings", () => {
    expect(get_frequency("unknown")).toBe(0);
    expect(get_frequency("")).toBe(0);
  });

  test("returns number directly when input is a number", () => {
    expect(get_frequency(0)).toBe(0);
    expect(get_frequency(5)).toBe(5);
    expect(get_frequency(11)).toBe(11);
  });

  test("returns 0 as the index for '5m' (first element)", () => {
    expect(get_frequency("5m")).toBe(0);
  });
});

// --- md5sum ---

describe("md5sum", () => {
  const tmpDir = join(process.cwd(), "tmp_test_md5sum");
  const tmpFile = join(tmpDir, "test_md5.txt");

  afterAll(() => {
    try {
      if (existsSync(tmpFile)) unlinkSync(tmpFile);
      if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    } catch { /* ignore cleanup errors */ }
  });

  test("returns MD5 hex string for an existing file", () => {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(tmpFile, "hello world", "utf-8");

    const result = md5sum(tmpFile);
    expect(result).toBe("5eb63bbbe01eeed093cb22bb8f5acdc3");
  });

  test("returns MD5 for empty file", () => {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(tmpFile, "", "utf-8");

    const result = md5sum(tmpFile);
    // MD5 of empty string
    expect(result).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });

  test("returns null for nonexistent file", () => {
    const result = md5sum("/nonexistent/path/file.txt");
    expect(result).toBeNull();
  });
});

// --- get_config_path ---

describe("get_config_path", () => {
  test("returns path ending with config.json by default", () => {
    const result = get_config_path();
    expect(result).toContain("config.json");
  });

  test("returns path under .mootdx directory", () => {
    const result = get_config_path();
    expect(result).toContain(".mootdx");
  });

  test("uses custom filename when provided", () => {
    const result = get_config_path("custom.json");
    expect(result).toContain("custom.json");
    expect(result).not.toContain("config.json");
  });

  test("creates .mootdx directory if it does not exist", () => {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
    const mootdxDir = join(home, ".mootdx");
    // Calling get_config_path should ensure the directory exists
    get_config_path();
    expect(existsSync(mootdxDir)).toBe(true);
  });
});
