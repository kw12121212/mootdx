import { test, expect } from "bun:test";
import {
  Market,
  KlineType,
  type OhlcBar,
  type Quote,
  type XdxrRecord,
  type Transaction,
  type FinancialFile,
  type SecurityInfo,
  MARKET_SZ,
  MARKET_SH,
  MARKET_BJ,
  KLINE_5MIN,
  KLINE_DAILY,
  KLINE_YEARLY,
  MAX_TRANSACTION_COUNT,
  MAX_KLINE_COUNT,
  FREQUENCY,
  HQ_HOSTS,
  EX_HOSTS,
  GP_HOSTS,
  CONFIG,
  MootdxError,
  MootdxValidationError,
  MootdxModuleNotFoundError,
  FileNeedRefresh,
  createLogger,
  getConfig,
  setup,
  get,
  set,
  has,
  clone,
  update,
  get_stock_market,
  get_stock_markets,
  get_frequency,
  md5sum,
  get_config_path,
} from "./index";

test("smoke test", () => {
  expect(true).toBe(true);
});

test("Market enum values match Python consts", () => {
  expect(Market.SZ).toBe(0);
  expect(Market.SH).toBe(1);
  expect(Market.BJ).toBe(2);
});

test("KlineType enum values match Python consts", () => {
  expect(KlineType.KLINE_5MIN).toBe(0);
  expect(KlineType.KLINE_DAILY).toBe(4);
  expect(KlineType.KLINE_WEEKLY).toBe(5);
  expect(KlineType.KLINE_MONTHLY).toBe(6);
  expect(KlineType.KLINE_1MIN).toBe(8);
  expect(KlineType.KLINE_YEARLY).toBe(11);
});

test("OhlcBar interface is satisfied by valid data", () => {
  const bar: OhlcBar = {
    date: "2024-01-01",
    open: 10.5,
    high: 11.0,
    low: 10.0,
    close: 10.8,
    vol: 100000,
    amount: 1080000,
  };
  expect(bar.close).toBe(10.8);
  expect(bar.date).toBe("2024-01-01");
});

test("Quote interface has bid/ask levels", () => {
  const quote: Quote = {
    market: Market.SH,
    code: "600000",
    active: 1,
    price: 10.5,
    lastClose: 10.3,
    open: 10.4,
    high: 10.8,
    low: 10.2,
    servertime: 1704067200,
    vol: 50000,
    curVol: 100,
    amount: 525000,
    sVol: 25000,
    bVol: 25000,
    bid1: { price: 10.4, volume: 1000 },
    bid2: { price: 10.3, volume: 2000 },
    bid3: { price: 10.2, volume: 3000 },
    bid4: { price: 10.1, volume: 4000 },
    bid5: { price: 10.0, volume: 5000 },
    ask1: { price: 10.5, volume: 1000 },
    ask2: { price: 10.6, volume: 2000 },
    ask3: { price: 10.7, volume: 3000 },
    ask4: { price: 10.8, volume: 4000 },
    ask5: { price: 10.9, volume: 5000 },
  };
  expect(quote.bid1.price).toBe(10.4);
  expect(quote.ask5.volume).toBe(5000);
});

test("XdxrRecord allows nullable fields", () => {
  const record: XdxrRecord = {
    year: 2024,
    month: 6,
    day: 15,
    category: 1,
    fenhong: 0.5,
    peigujia: null,
    songzhuangu: null,
    peigu: null,
    suogu: null,
    panqianliutong: null,
    panhouliutong: null,
    qianzongguben: null,
    houzongguben: null,
    fenshu: null,
    xingquanjia: null,
  };
  expect(record.fenhong).toBe(0.5);
  expect(record.peigujia).toBeNull();
});

test("Transaction has expected fields", () => {
  const tx: Transaction = {
    time: "14:57",
    price: 10.5,
    vol: 100,
    num: 12345,
    buyOrSell: 1,
  };
  expect(tx.buyOrSell).toBe(1);
});

test("FinancialFile matches affair.py structure", () => {
  const file: FinancialFile = {
    filename: "cw_20240615.zip",
    hash: "abc123",
    filesize: 1024,
  };
  expect(file.filesize).toBe(1024);
});

test("SecurityInfo has market, code, name", () => {
  const info: SecurityInfo = {
    market: Market.SZ,
    code: "000001",
    name: "平安银行",
  };
  expect(info.code).toBe("000001");
});

// Consts tests
test("market constants match Python", () => {
  expect(MARKET_SZ).toBe(0);
  expect(MARKET_SH).toBe(1);
  expect(MARKET_BJ).toBe(2);
});

test("kline type constants match Python", () => {
  expect(KLINE_5MIN).toBe(0);
  expect(KLINE_DAILY).toBe(4);
  expect(KLINE_YEARLY).toBe(11);
});

test("limits match Python", () => {
  expect(MAX_TRANSACTION_COUNT).toBe(2000);
  expect(MAX_KLINE_COUNT).toBe(800);
});

test("FREQUENCY array has 12 entries matching Python", () => {
  expect(FREQUENCY).toHaveLength(12);
  expect(FREQUENCY[0]).toBe("5m");
  expect(FREQUENCY[4]).toBe("day");
  expect(FREQUENCY[11]).toBe("year");
});

test("HQ_HOSTS has 38 entries", () => {
  expect(HQ_HOSTS).toHaveLength(38);
  expect(HQ_HOSTS[0]![0]).toBe("深圳双线主站1");
  expect(HQ_HOSTS[0]![2]).toBe(7709);
});

test("EX_HOSTS has 3 entries", () => {
  expect(EX_HOSTS).toHaveLength(3);
  expect(EX_HOSTS[0]![2]).toBe(7720);
});

test("GP_HOSTS has 1 entry", () => {
  expect(GP_HOSTS).toHaveLength(1);
  expect(GP_HOSTS[0]![2]).toBe(7709);
});

test("CONFIG has SERVER/BESTIP/TDXDIR structure", () => {
  expect(CONFIG.SERVER.HQ).toBe(HQ_HOSTS);
  expect(CONFIG.SERVER.EX).toBe(EX_HOSTS);
  expect(CONFIG.SERVER.GP).toBe(GP_HOSTS);
  expect(CONFIG.TDXDIR).toBe("C:/new_tdx");
});

// Exceptions tests
test("MootdxError is an Error with optional metadata", () => {
  const err = new MootdxError("test error", { provider: "test" });
  expect(err).toBeInstanceOf(Error);
  expect(err.message).toBe("test error");
  expect(err.name).toBe("MootdxError");
  expect(err.provider).toBe("test");
});

test("MootdxValidationError is an Error", () => {
  const err = new MootdxValidationError("bad input");
  expect(err).toBeInstanceOf(Error);
  expect(err.name).toBe("MootdxValidationError");
  expect(err.message).toBe("bad input");
});

test("MootdxModuleNotFoundError is an Error", () => {
  const err = new MootdxModuleNotFoundError("not found");
  expect(err).toBeInstanceOf(Error);
  expect(err.name).toBe("MootdxModuleNotFoundError");
});

test("FileNeedRefresh is an Error", () => {
  const err = new FileNeedRefresh("stale");
  expect(err).toBeInstanceOf(Error);
  expect(err.name).toBe("FileNeedRefresh");
});

// Logger tests
test("createLogger returns object with debug/info/warn/error methods", () => {
  const log = createLogger("test");
  expect(typeof log.debug).toBe("function");
  expect(typeof log.info).toBe("function");
  expect(typeof log.warn).toBe("function");
  expect(typeof log.error).toBe("function");
});

test("logger methods do not throw", () => {
  const log = createLogger("test");
  expect(() => log.debug("debug msg")).not.toThrow();
  expect(() => log.info("info msg")).not.toThrow();
  expect(() => log.warn("warn msg")).not.toThrow();
  expect(() => log.error("error msg")).not.toThrow();
});

// Config tests
test("getConfig returns default CONFIG structure", () => {
  const cfg = getConfig();
  expect(cfg.SERVER).toBeDefined();
  expect(cfg.BESTIP).toBeDefined();
  expect(cfg.TDXDIR).toBe("C:/new_tdx");
});

test("get returns top-level value", () => {
  const val = get("TDXDIR");
  expect(val).toBe("C:/new_tdx");
});

test("get supports dot-notation keys", () => {
  const val = get("BESTIP.HQ");
  expect(val).toBe("");
});

test("get returns default for missing nested key", () => {
  const val = get("BESTIP.MISSING", "fallback");
  expect(val).toBe("fallback");
});

test("set updates config value", () => {
  set("TDXDIR", "/new/path");
  expect(get("TDXDIR")).toBe("/new/path");
  set("TDXDIR", "C:/new_tdx");
});

test("has checks if value exists in config entry", () => {
  expect(has("SERVER", "HQ")).toBe(true);
  expect(has("SERVER", "NONEXISTENT")).toBe(false);
});

test("clone returns deep copy", () => {
  const copy = clone();
  expect(copy).not.toBe(getConfig());
  expect(copy.TDXDIR).toBe(getConfig().TDXDIR);
});

test("update merges partial config", () => {
  const orig = get("TDXDIR");
  update({ TDXDIR: "/updated" });
  expect(get("TDXDIR")).toBe("/updated");
  update({ TDXDIR: orig as string });
});

test("setup returns boolean", () => {
  const result = setup();
  expect(typeof result).toBe("boolean");
});

// Utils tests
test("get_stock_market returns SH for 6-prefix codes", () => {
  expect(get_stock_market("600000")).toBe(1);
  expect(get_stock_market("600000", true)).toBe("sh");
});

test("get_stock_market returns SZ for 0-prefix codes", () => {
  expect(get_stock_market("000001")).toBe(0);
  expect(get_stock_market("000001", true)).toBe("sz");
});

test("get_stock_market returns BJ for 8-prefix codes", () => {
  expect(get_stock_market("830001")).toBe(2);
  expect(get_stock_market("430001")).toBe(2);
});

test("get_stock_market handles sh/sz prefix", () => {
  expect(get_stock_market("sh600000")).toBe(1);
  expect(get_stock_market("sz000001")).toBe(0);
});

test("get_stock_market returns SZ for 30-prefix", () => {
  expect(get_stock_market("300001")).toBe(0);
});

test("get_stock_market returns SH for 68-prefix", () => {
  expect(get_stock_market("688001")).toBe(1);
});

test("get_stock_markets processes multiple symbols", () => {
  const result = get_stock_markets(["600000", "000001"]);
  expect(result).toEqual([[1, "600000"], [0, "000001"]]);
});

test("get_frequency returns index for string", () => {
  expect(get_frequency("5m")).toBe(0);
  expect(get_frequency("day")).toBe(4);
  expect(get_frequency("year")).toBe(11);
});

test("get_frequency returns 0 for unknown string", () => {
  expect(get_frequency("unknown")).toBe(0);
});

test("get_frequency passes through number", () => {
  expect(get_frequency(4)).toBe(4);
});

test("md5sum returns null for missing file", () => {
  expect(md5sum("/nonexistent/file.txt")).toBeNull();
});

test("md5sum returns hex digest for existing file", () => {
  const tmpFile = `/tmp/mootdx-test-md5-${Date.now()}.txt`;
  require("fs").writeFileSync(tmpFile, "hello world");
  const hash = md5sum(tmpFile);
  expect(hash).toBe("5eb63bbbe01eeed093cb22bb8f5acdc3");
  require("fs").unlinkSync(tmpFile);
});

test("get_config_path returns path under ~/.mootdx", () => {
  const p = get_config_path("test.json");
  expect(p).toContain(".mootdx");
  expect(p).toContain("test.json");
});
