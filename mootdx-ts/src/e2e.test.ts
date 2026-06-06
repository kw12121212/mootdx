import { describe, test, expect } from "bun:test";
import {
  Market,
  KlineType,
  MARKET_SZ,
  MARKET_SH,
  MARKET_BJ,
  KLINE_DAILY,
  KLINE_5MIN,
  MAX_KLINE_COUNT,
  HQ_HOSTS,
  EX_HOSTS,
  CONFIG,
  MootdxValidationError,
  getConfig,
  setup,
  get,
  set,
  has,
  get_stock_market,
  get_stock_markets,
  get_frequency,
  md5sum,
  getPrice,
  getVolume,
  getDatetime,
  getTime,
  columns,
  COLUMN_COUNT,
  factorReversion,
  dividendReversion,
  etfReversion,
  reversion,
  parseDailyBars,
  parseLCMinuteBars,
  parseMinuteBars,
  parseExDailyBars,
} from "./index";

// ---------------------------------------------------------------------------
// 1. Types & Constants
// ---------------------------------------------------------------------------

describe("types and constants", () => {
  test("Market enum values", () => {
    expect(Market.SZ).toBe(0);
    expect(Market.SH).toBe(1);
    expect(Market.BJ).toBe(2);
  });

  test("KlineType enum values", () => {
    expect(KlineType.KLINE_5MIN).toBe(0);
    expect(KlineType.KLINE_DAILY).toBe(4);
    expect(KlineType.KLINE_WEEKLY).toBe(5);
    expect(KlineType.KLINE_MONTHLY).toBe(6);
  });

  test("MARKET_* constants", () => {
    expect(MARKET_SZ).toBe(0);
    expect(MARKET_SH).toBe(1);
    expect(MARKET_BJ).toBe(2);
  });

  test("KLINE_* constants", () => {
    expect(KLINE_DAILY).toBe(4);
    expect(KLINE_5MIN).toBe(0);
  });

  test("MAX_KLINE_COUNT is 800", () => {
    expect(MAX_KLINE_COUNT).toBe(800);
  });

  test("HQ_HOSTS is a non-empty array of [name, ip, port] tuples", () => {
    expect(Array.isArray(HQ_HOSTS)).toBe(true);
    expect(HQ_HOSTS.length).toBeGreaterThan(10);
    for (const host of HQ_HOSTS) {
      expect(host.length).toBe(3);
      expect(typeof host[0]).toBe("string");
      expect(typeof host[1]).toBe("string");
      expect(typeof host[2]).toBe("number");
    }
  });

  test("EX_HOSTS is a non-empty array", () => {
    expect(Array.isArray(EX_HOSTS)).toBe(true);
    expect(EX_HOSTS.length).toBeGreaterThan(0);
  });

  test("CONFIG has expected structure", () => {
    expect(CONFIG.SERVER).toBeDefined();
    expect(CONFIG.BESTIP).toBeDefined();
    expect(CONFIG.TDXDIR).toBeDefined();
    expect(CONFIG.SERVER.HQ).toBe(HQ_HOSTS);
  });
});

// ---------------------------------------------------------------------------
// 2. Exceptions
// ---------------------------------------------------------------------------

describe("exceptions", () => {
  test("MootdxValidationError is constructable", () => {
    const err = new MootdxValidationError("bad input");
    expect(err.message).toBe("bad input");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(MootdxValidationError);
  });
});

// ---------------------------------------------------------------------------
// 3. Config
// ---------------------------------------------------------------------------

describe("config", () => {
  test("setup returns boolean", () => {
    const result = setup();
    expect(typeof result).toBe("boolean");
  });

  test("getConfig returns object with required keys", () => {
    const cfg = getConfig();
    expect(cfg).toBeDefined();
    expect(cfg.SERVER).toBeDefined();
    expect(cfg.BESTIP).toBeDefined();
    expect(cfg.TDXDIR).toBeDefined();
  });

  test("set and get round-trip", () => {
    set("TEST_KEY", "test_value");
    expect(get("TEST_KEY")).toBe("test_value");
  });

  test("has checks key existence in object values", () => {
    set("TEST_HAS_OBJ", { inner: 42 });
    expect(has("TEST_HAS_OBJ", "inner")).toBe(true);
    expect(has("TEST_HAS_OBJ", "missing")).toBe(false);
  });

  test("get with dot-notation path", () => {
    set("NESTED", { a: { b: 99 } });
    expect(get("NESTED.a.b")).toBe(99);
  });

  test("get returns default for missing nested path", () => {
    expect(get("NESTED.x.y", "fallback")).toBe("fallback");
  });
});

// ---------------------------------------------------------------------------
// 4. Utils — stock market detection
// ---------------------------------------------------------------------------

describe("get_stock_market", () => {
  test("detects SH from prefix", () => {
    expect(get_stock_market("sh600036")).toBe(MARKET_SH);
  });

  test("detects SZ from prefix", () => {
    expect(get_stock_market("sz000001")).toBe(MARKET_SZ);
  });

  test("detects BJ from prefix", () => {
    expect(get_stock_market("bj430047")).toBe(MARKET_BJ);
  });

  test("detects SH from code starting with 6", () => {
    expect(get_stock_market("600036")).toBe(MARKET_SH);
  });

  test("detects SZ from code starting with 0", () => {
    expect(get_stock_market("000001")).toBe(MARKET_SZ);
  });

  test("detects SH from code starting with 68", () => {
    expect(get_stock_market("689009")).toBe(MARKET_SH);
  });

  test("detects BJ from code starting with 8", () => {
    expect(get_stock_market("830946")).toBe(MARKET_BJ);
  });

  test("detects BJ from code starting with 4", () => {
    expect(get_stock_market("430047")).toBe(MARKET_BJ);
  });

  test("returns string when asString=true", () => {
    expect(get_stock_market("sh600036", true)).toBe("sh");
    expect(get_stock_market("sz000001", true)).toBe("sz");
    expect(get_stock_market("bj430047", true)).toBe("bj");
  });
});

describe("get_stock_markets", () => {
  test("maps multiple symbols to [market, code] tuples", () => {
    const result = get_stock_markets(["sh600036", "sz000001"]);
    expect(result).toEqual([
      [MARKET_SH, "600036"],
      [MARKET_SZ, "000001"],
    ]);
  });
});

describe("get_frequency", () => {
  test("maps string frequency to number", () => {
    expect(get_frequency("5m")).toBe(0);
    expect(get_frequency("day")).toBe(4);
  });

  test("passes through numeric input", () => {
    expect(get_frequency(4)).toBe(4);
  });

  test("returns 0 for unknown string", () => {
    expect(get_frequency("unknown")).toBe(0);
  });
});

describe("md5sum", () => {
  test("returns null for nonexistent file", () => {
    expect(md5sum("/nonexistent/path/file.txt")).toBeNull();
  });

  test("returns hex string for existing file", () => {
    const path = import.meta.path;
    const hash = md5sum(path);
    expect(hash).not.toBeNull();
    expect(hash!.length).toBe(32);
    expect(/^[0-9a-f]{32}$/.test(hash!)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Protocol helpers
// ---------------------------------------------------------------------------

describe("getPrice", () => {
  test("decodes a single-byte positive value", () => {
    const buf = Buffer.from([0x25]); // 0b00100101 = 37
    const [value, offset] = getPrice(buf, 0);
    expect(value).toBe(37);
    expect(offset).toBe(1);
  });

  test("decodes a single-byte negative value", () => {
    const buf = Buffer.from([0x45]); // 0b01000101 = sign bit + 5
    const [value, offset] = getPrice(buf, 0);
    expect(value).toBe(-5);
    expect(offset).toBe(1);
  });

  test("decodes a multi-byte value", () => {
    // 0x80 | 0x25 = continuation + 37, then 0x03
    const buf = Buffer.from([0x80 | 0x25, 0x03]);
    const [value, offset] = getPrice(buf, 0);
    expect(offset).toBe(2);
    expect(typeof value).toBe("number");
  });
});

describe("getVolume", () => {
  test("returns a number for any input", () => {
    const result = getVolume(0x01020304);
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(0);
  });

  test("returns small value for zero input", () => {
    const result = getVolume(0);
    expect(typeof result).toBe("number");
    // The algorithm produces a very small float near zero
    expect(Math.abs(result)).toBeLessThan(1);
  });
});

describe("getDatetime", () => {
  test("decodes packed datetime for daily category (4)", () => {
    const buf = Buffer.alloc(4);
    // 20240101 as U32 = 0x001EEA81
    buf.writeUInt32LE(20240101, 0);
    const [y, m, d, h, min, off] = getDatetime(buf, 0, 4);
    expect(y).toBe(2024);
    expect(m).toBe(1);
    expect(d).toBe(1);
    expect(h).toBe(15);
    expect(min).toBe(0);
    expect(off).toBe(4);
  });
});

describe("getTime", () => {
  test("decodes tminutes to hour and minute", () => {
    const buf = Buffer.alloc(2);
    buf.writeUInt16LE(570, 0); // 9:30
    const [h, m, off] = getTime(buf, 0);
    expect(h).toBe(9);
    expect(m).toBe(30);
    expect(off).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 6. Financial columns
// ---------------------------------------------------------------------------

describe("financial columns", () => {
  test("columns array has COLUMN_COUNT entries", () => {
    expect(columns.length).toBe(COLUMN_COUNT);
  });

  test("first column is report_date", () => {
    expect(columns[0]).toBe("report_date");
  });

  test("columns contain key financial fields", () => {
    expect(columns).toContain("基本每股收益");
    expect(columns).toContain("每股净资产");
    expect(columns).toContain("货币资金");
  });
});

// ---------------------------------------------------------------------------
// 7. Binary parsers (with crafted buffers)
// ---------------------------------------------------------------------------

describe("parseDailyBars", () => {
  test("parses a single daily bar record", () => {
    const buf = Buffer.alloc(32);
    // date: 20240101
    buf.writeUInt32LE(20240101, 0);
    // open: 1000 (raw = 100000 for SH_A with 0.01 coeff)
    buf.writeUInt32LE(100000, 4);
    // high
    buf.writeUInt32LE(105000, 8);
    // low
    buf.writeUInt32LE(95000, 12);
    // close
    buf.writeUInt32LE(102000, 16);
    // amount: float
    buf.writeFloatLE(50000000.0, 20);
    // vol
    buf.writeUInt32LE(100000, 24);
    // reserved
    buf.writeUInt32LE(0, 28);

    const bars = parseDailyBars(buf, "sh600036.day");
    expect(bars.length).toBe(1);
    expect(bars[0]!.date).toBe("2024-01-01");
    expect(bars[0]!.open).toBeCloseTo(1000.0, 1);
    expect(bars[0]!.high).toBeCloseTo(1050.0, 1);
    expect(bars[0]!.low).toBeCloseTo(950.0, 1);
    expect(bars[0]!.close).toBeCloseTo(1020.0, 1);
    expect(bars[0]!.vol).toBeCloseTo(1000.0, 1);
    expect(bars[0]!.amount).toBeCloseTo(50000000.0, 0);
  });

  test("returns empty array for empty buffer", () => {
    expect(parseDailyBars(Buffer.alloc(0), "sh600036.day")).toEqual([]);
  });

  test("uses different coefficients for SZ vs SH", () => {
    const buf = Buffer.alloc(32);
    buf.writeUInt32LE(20240101, 0);
    buf.writeUInt32LE(100000, 4);
    buf.writeUInt32LE(100000, 8);
    buf.writeUInt32LE(100000, 12);
    buf.writeUInt32LE(100000, 16);
    buf.writeFloatLE(0, 20);
    buf.writeUInt32LE(100, 24);
    buf.writeUInt32LE(0, 28);

    const shBars = parseDailyBars(buf, "sh600036.day");
    const szBars = parseDailyBars(buf, "sz000001.day");

    // Both SH_A and SZ_A have same coeff [0.01, 0.01]
    expect(shBars[0]!.open).toBeCloseTo(szBars[0]!.open, 5);
  });
});

describe("parseLCMinuteBars", () => {
  test("parses a single LC minute bar record", () => {
    const buf = Buffer.alloc(32);
    // packed date: year = raw/2048 + 2004, month = (raw%2048)/100, day = (raw%2048)%100
    // 2024 => (2024-2004)*2048 + 1*100 + 15 = 20*2048 + 115 = 41075
    const packedDate = 20 * 2048 + 1 * 100 + 15;
    buf.writeUInt16LE(packedDate, 0);
    // packed time: 9*60+30 = 570
    buf.writeUInt16LE(570, 2);
    // OHLC as floats
    buf.writeFloatLE(10.5, 4);
    buf.writeFloatLE(10.8, 8);
    buf.writeFloatLE(10.3, 12);
    buf.writeFloatLE(10.6, 16);
    buf.writeFloatLE(1000000.0, 20);
    buf.writeUInt32LE(50000, 24);
    buf.writeUInt32LE(0, 28);

    const bars = parseLCMinuteBars(buf);
    expect(bars.length).toBe(1);
    expect(bars[0]!.date).toContain("2024-01-15");
    expect(bars[0]!.date).toContain("09:30");
    expect(bars[0]!.open).toBeCloseTo(10.5, 3);
    expect(bars[0]!.high).toBeCloseTo(10.8, 3);
    expect(bars[0]!.close).toBeCloseTo(10.6, 3);
    expect(bars[0]!.vol).toBe(50000);
  });

  test("returns empty array for empty buffer", () => {
    expect(parseLCMinuteBars(Buffer.alloc(0))).toEqual([]);
  });
});

describe("parseMinuteBars", () => {
  test("parses a single minute bar with /100 coefficient", () => {
    const buf = Buffer.alloc(32);
    const packedDate = 20 * 2048 + 6 * 100 + 1;
    buf.writeUInt16LE(packedDate, 0);
    buf.writeUInt16LE(570, 2);
    buf.writeUInt32LE(105000, 4);  // open / 100 = 1050
    buf.writeUInt32LE(108000, 8);
    buf.writeUInt32LE(103000, 12);
    buf.writeUInt32LE(106000, 16);
    buf.writeFloatLE(500000.0, 20);
    buf.writeUInt32LE(10000, 24);
    buf.writeUInt32LE(0, 28);

    const bars = parseMinuteBars(buf);
    expect(bars.length).toBe(1);
    expect(bars[0]!.open).toBeCloseTo(1050, 1);
    expect(bars[0]!.high).toBeCloseTo(1080, 1);
  });

  test("returns empty array for empty buffer", () => {
    expect(parseMinuteBars(Buffer.alloc(0))).toEqual([]);
  });
});

describe("parseExDailyBars", () => {
  test("returns empty array for empty buffer", () => {
    expect(parseExDailyBars(Buffer.alloc(0))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 8. Price adjustment / reversion
// ---------------------------------------------------------------------------

describe("factorReversion", () => {
  const sampleData: import("./types").OhlcBar[] = [
    { date: "2024-01-02", open: 10, high: 11, low: 9, close: 10.5, vol: 1000, amount: 10000 },
    { date: "2024-01-03", open: 10.5, high: 11.5, low: 10, close: 11, vol: 1200, amount: 12000 },
    { date: "2024-01-04", open: 11, high: 12, low: 10.5, close: 11.5, vol: 1100, amount: 11000 },
  ];
  const factorData: import("./types").FactorRecord[] = [
    { date: "2024-01-02", qfq: 1.0, hfq: 1.0 },
    { date: "2024-01-03", qfq: 0.95, hfq: 1.05 },
    { date: "2024-01-04", qfq: 0.90, hfq: 1.10 },
  ];

  test("returns data unchanged when factor data is empty", () => {
    const result = factorReversion(sampleData, []);
    expect(result).toEqual(sampleData);
  });

  test("qfq adjusts prices by backfilled factor", () => {
    const result = factorReversion(sampleData, factorData, "qfq");
    expect(result.length).toBe(3);
    // Last bar should have factor 0.90
    expect(result[2]!.close).toBeCloseTo(11.5 * 0.90, 5);
  });

  test("hfq adjusts prices by forward-filled factor", () => {
    const result = factorReversion(sampleData, factorData, "hfq");
    expect(result.length).toBe(3);
    // First bar should have factor 1.0 (no prior hfq factor seen for qfq path)
    expect(result[0]!.close).toBeCloseTo(10.5 * 1.0, 5);
  });

  test("returns empty array for empty input", () => {
    expect(factorReversion([], factorData)).toEqual([]);
  });
});

describe("dividendReversion", () => {
  const sampleData: import("./types").OhlcBar[] = [
    { date: "2024-01-02", open: 10, high: 11, low: 9, close: 10.5, vol: 1000, amount: 10000 },
    { date: "2024-01-03", open: 10.5, high: 11.5, low: 10, close: 11, vol: 1200, amount: 12000 },
  ];

  test("returns data unchanged when no dividend records", () => {
    const result = dividendReversion(sampleData, []);
    expect(result).toEqual(sampleData);
  });

  test("returns data unchanged when only non-dividend xdxr records", () => {
    const xdxr: import("./types").XdxrRecord[] = [
      { year: 2024, month: 1, day: 2, category: 2, fenhong: null, peigujia: null, songzhuangu: null, peigu: null, suogu: null, panqianliutong: null, panhouliutong: null, qianzongguben: null, houzongguben: null, fenshu: null, xingquanjia: null },
    ];
    const result = dividendReversion(sampleData, xdxr);
    expect(result).toEqual(sampleData);
  });

  test("applies dividend adjustment with category 1 records", () => {
    const xdxr: import("./types").XdxrRecord[] = [
      { year: 2024, month: 1, day: 2, category: 1, fenhong: 1.0, peigujia: 0, songzhuangu: 0, peigu: 0, suogu: null, panqianliutong: null, panhouliutong: null, qianzongguben: null, houzongguben: null, fenshu: null, xingquanjia: null },
    ];
    const result = dividendReversion(sampleData, xdxr, "qfq");
    expect(result.length).toBeGreaterThan(0);
    // Prices should have been adjusted (not equal to original)
    expect(result[0]!.close).not.toBe(10.5);
  });
});

describe("etfReversion", () => {
  const sampleData: import("./types").OhlcBar[] = [
    { date: "2024-01-02", open: 1.0, high: 1.1, low: 0.9, close: 1.05, vol: 1000, amount: 1000 },
    { date: "2024-01-03", open: 1.05, high: 1.15, low: 1.0, close: 1.1, vol: 1200, amount: 1200 },
  ];

  test("returns data unchanged when no ETF xdxr records", () => {
    const result = etfReversion(sampleData, []);
    expect(result).toEqual(sampleData);
  });

  test("applies ETF split adjustment", () => {
    const xdxr: import("./types").XdxrRecord[] = [
      { year: 2024, month: 1, day: 3, category: 11, fenhong: null, peigujia: null, songzhuangu: null, peigu: null, suogu: 2.0, panqianliutong: null, panhouliutong: null, qianzongguben: null, houzongguben: null, fenshu: null, xingquanjia: null },
    ];
    const result = etfReversion(sampleData, xdxr, "qfq");
    expect(result.length).toBe(2);
    // First bar should have prices divided by 2 (suogu=2 applied to previous bar)
    expect(result[0]!.close).toBeCloseTo(1.05 / 2, 5);
  });
});

describe("reversion dispatcher", () => {
  test("dispatches to etfReversion for ETF symbols", () => {
    const sampleData: import("./types").OhlcBar[] = [
      { date: "2024-01-01", open: 10, high: 11, low: 9, close: 10.5, vol: 1000, amount: 10000 },
      { date: "2024-01-02", open: 10.5, high: 11.5, low: 10, close: 11, vol: 1200, amount: 12000 },
    ];
    const xdxr: import("./types").XdxrRecord[] = [
      { year: 2024, month: 1, day: 2, category: 11, fenhong: null, peigujia: null, songzhuangu: null, peigu: null, suogu: 2.0, panqianliutong: null, panhouliutong: null, qianzongguben: null, houzongguben: null, fenshu: null, xingquanjia: null },
    ];
    const result = reversion("sh510050", sampleData, xdxr, "qfq");
    expect(result.length).toBe(2);
    // First bar should be adjusted (divided by suogu=2) since xdxr date matches second bar
    expect(result[0]!.close).toBeCloseTo(10.5 / 2, 5);
  });
});

// ---------------------------------------------------------------------------
// 9. decodeGBK — shared utility
// ---------------------------------------------------------------------------

describe("decodeGBK", () => {
  test("decodes ASCII bytes as-is", async () => {
    const { decodeGBK } = await import("./utils");
    const buf = Buffer.from("hello", "ascii");
    expect(decodeGBK(buf)).toBe("hello");
  });

  test("decodes GB2312-encoded Chinese characters", async () => {
    const { decodeGBK } = await import("./utils");
    // GB2312 for "中国" (Zhongguo): D6 D0 B9 FA
    const buf = Buffer.from([0xd6, 0xd0, 0xb9, 0xfa]);
    const result = decodeGBK(buf);
    expect(result).toBe("中国");
  });
});

// ---------------------------------------------------------------------------
// 10. Reader factory errors
// ---------------------------------------------------------------------------

describe("reader factory", () => {
  test("reader throws for nonexistent tdxdir", async () => {
    const { reader } = await import("./reader");
    expect(() => reader("std", "/nonexistent/tdxdir/path")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 11. Quotes base class
// ---------------------------------------------------------------------------

describe("quotes base", () => {
  test("BaseQuotes constructor initializes config", async () => {
    const { BaseQuotes } = await import("./quotes");
    // BaseQuotes is abstract; we can't instantiate directly, but we can
    // verify the module exports it as a class
    expect(typeof BaseQuotes).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// 12. Cache decorators
// ---------------------------------------------------------------------------

describe("fileCache decorator", () => {
  test("fileCache is exported as a function", () => {
    const { fileCache } = require("./cache/file");
    expect(typeof fileCache).toBe("function");
  });
});

describe("lruCache decorator", () => {
  test("lruCache is exported as a function", () => {
    const { lruCache } = require("./cache/timed");
    expect(typeof lruCache).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// 13. Holiday utilities (basic)
// ---------------------------------------------------------------------------

describe("holiday utilities", () => {
  test("holidays is an async function", async () => {
    const { holidays } = await import("./utils/holiday");
    expect(typeof holidays).toBe("function");
    const result = await holidays();
    expect(Array.isArray(result)).toBe(true);
  });

  test("tdxHolidays is an async function", async () => {
    const { tdxHolidays } = await import("./utils/holiday");
    expect(typeof tdxHolidays).toBe("function");
    const result = await tdxHolidays();
    expect(Array.isArray(result)).toBe(true);
  });

  test("isHoliday returns boolean for a Saturday", async () => {
    const { isHoliday } = await import("./utils/holiday");
    // 2024-01-06 is a Saturday
    const result = await isHoliday("2024-01-06");
    expect(result).toBe(true);
  });

  test("isHoliday returns false for a weekday", async () => {
    const { isHoliday } = await import("./utils/holiday");
    // 2024-01-03 is a Wednesday (assuming not a Chinese holiday)
    const result = await isHoliday("2024-01-03");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 14. Contrib — getAdjustYear
// ---------------------------------------------------------------------------

describe("getAdjustYear", () => {
  test("getAdjustYear is an async function requiring symbol", async () => {
    const { getAdjustYear } = await import("./contrib/adjust");
    expect(typeof getAdjustYear).toBe("function");
    // Without network, it returns empty array
    const result = await getAdjustYear("600036", 2024, "01");
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 15. Timer utility
// ---------------------------------------------------------------------------

describe("timeit decorator", () => {
  test("timeit is exported as a function", () => {
    const { timeit } = require("./cache/timer");
    expect(typeof timeit).toBe("function");
  });
});
