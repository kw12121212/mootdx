import { setup as configSetup, get as configGet } from "./config";
import { MARKET_SZ, MARKET_SH, MAX_KLINE_COUNT } from "./consts";
import { createLogger } from "./logger";
import { TdxBaseApi } from "./protocol/base";
import { setupCommands } from "./protocol/login";
import { HeartbeatManager } from "./protocol/heartbeat";
import { getSecurityBars } from "./protocol/security_bars";
import { getIndexBars } from "./protocol/index_bars";
import { getSecurityCount } from "./protocol/security_count";
import { getSecurityList } from "./protocol/security_list";
import { getSecurityQuotes } from "./protocol/security_quotes";
import { getMinuteTimeData, getHistoryMinuteTimeData } from "./protocol/minute_time";
import { getTransactionData, getHistoryTransactionData } from "./protocol/transaction";
import { getXdXrInfo } from "./protocol/xdxr";
import { getFinanceInfo } from "./protocol/finance";
import { getCompanyInfoCategory, getCompanyInfoContent } from "./protocol/company_info";
import { getBlockInfoMeta, getBlockInfo } from "./protocol/block";
import { EX_SETUP_CMD } from "./protocol/ext/setup";
import { getInstrumentCount, getInstrumentList } from "./protocol/ext/instruments";
import { getInstrumentBars } from "./protocol/ext/instrument_bars";
import { getInstrumentQuote } from "./protocol/ext/instrument_quote";
import { get_stock_market, get_stock_markets, get_frequency } from "./utils";
import type {
  OhlcBar,
  Quote,
  MinuteData,
  Transaction,
  XdxrRecord,
  FinanceInfo,
  SecurityInfo,
  CompanyInfoCategory,
} from "./types";

const log = createLogger("quotes");

async function randomWait(): Promise<void> {
  const ms = Math.random() * 9000 + 1000;
  await new Promise((r) => setTimeout(r, ms));
}

export abstract class BaseQuotes {
  protected client: TdxBaseApi;
  protected heartbeat: HeartbeatManager | null = null;
  bestip: [string, number] | null = null;

  constructor() {
    configSetup();
    this.client = new TdxBaseApi();
  }

  protected async resolveServer(index: "HQ" | "EX"): Promise<[string, number]> {
    const bestip = configGet("BESTIP") as Record<string, [string, number]> | undefined;
    if (bestip && bestip[index]) {
      return bestip[index]!;
    }
    // Default fallback servers
    if (index === "HQ") {
      return ["119.147.212.81", 7709];
    }
    return ["112.74.214.43", 7727];
  }

  abstract connect(): Promise<void>;

  get closed(): boolean {
    return !this.client.connected;
  }

  async reconnect(): Promise<void> {
    if (this.closed) {
      await this.connect();
    }
  }

  close(): void {
    this.heartbeat?.stop();
    this.client.disconnect();
  }
}

export class StdQuotes extends BaseQuotes {
  override async connect(): Promise<void> {
    const [addr, port] = await this.resolveServer("HQ");
    this.bestip = [addr, port];
    await this.client.connect(addr, port);
    await setupCommands(this.client);
    this.heartbeat = new HeartbeatManager({
      onHeartbeat: () => this.client.sendRequest(0, Buffer.alloc(0)).then(() => {}),
      onDisconnect: () => this.client.disconnect(),
      interval: 15000,
    });
    this.heartbeat.start();
  }

  async traffic(): Promise<number> {
    return this.client.sendRequest(0, Buffer.alloc(0)).then(() => 0);
  }

  async quotes(symbol?: string | string[]): Promise<Quote[]> {
    await this.reconnect();
    let symbols: string[];
    if (!symbol) {
      symbols = ["sh000001", "sz399001"];
    } else if (typeof symbol === "string") {
      symbols = [symbol];
    } else {
      symbols = symbol;
    }

    const pairs = get_stock_markets(symbols);
    const markets = pairs.map(([m]) => m);
    const codes = pairs.map(([, c]) => c);

    return getSecurityQuotes(this.client, markets, codes);
  }

  async bars(
    symbol: string,
    frequency: string | number = "days",
    start: number = 0,
    offset: number = MAX_KLINE_COUNT,
  ): Promise<OhlcBar[]> {
    await this.reconnect();
    const market = get_stock_market(symbol) as number;
    const code = symbol.replace(/^(sh|sz|bj)/i, "");
    const cat = get_frequency(frequency);
    return getSecurityBars(this.client, cat, market, code, start, offset);
  }

  async stockCount(market: number = MARKET_SZ): Promise<number> {
    await this.reconnect();
    return getSecurityCount(this.client, market);
  }

  async stocks(market: number = MARKET_SZ): Promise<SecurityInfo[]> {
    await this.reconnect();
    const all: SecurityInfo[] = [];
    let start = 0;
    const batch = 1000;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const list = await getSecurityList(this.client, market, start);
      if (list.length === 0) break;
      all.push(...list);
      start += batch;
    }
    return all;
  }

  async stockAll(): Promise<SecurityInfo[]> {
    const sz = await this.stocks(MARKET_SZ);
    const sh = await this.stocks(MARKET_SH);
    return [...sz, ...sh];
  }

  async indexBars(
    symbol: string,
    frequency: string | number = "days",
    start: number = 0,
    offset: number = MAX_KLINE_COUNT,
  ): Promise<OhlcBar[]> {
    await this.reconnect();
    const market = get_stock_market(symbol) as number;
    const code = symbol.replace(/^(sh|sz|bj)/i, "");
    const cat = get_frequency(frequency);
    return getIndexBars(this.client, cat, market, code, start, offset);
  }

  async minute(symbol: string): Promise<MinuteData[]> {
    await this.reconnect();
    const market = get_stock_market(symbol) as number;
    const code = symbol.replace(/^(sh|sz|bj)/i, "");
    return getMinuteTimeData(this.client, market, code);
  }

  async minutes(symbol: string, date: number): Promise<MinuteData[]> {
    await this.reconnect();
    const market = get_stock_market(symbol) as number;
    const code = symbol.replace(/^(sh|sz|bj)/i, "");
    return getHistoryMinuteTimeData(this.client, market, code, date);
  }

  async transaction(symbol: string, start: number = 0, offset: number = 2000): Promise<Transaction[]> {
    await this.reconnect();
    const market = get_stock_market(symbol) as number;
    const code = symbol.replace(/^(sh|sz|bj)/i, "");
    return getTransactionData(this.client, market, code, start, offset);
  }

  async transactions(
    symbol: string,
    start: number = 0,
    offset: number = 2000,
    date: number = 0,
  ): Promise<Transaction[]> {
    await this.reconnect();
    const market = get_stock_market(symbol) as number;
    const code = symbol.replace(/^(sh|sz|bj)/i, "");
    return getHistoryTransactionData(this.client, market, code, start, offset, date);
  }

  async F10C(symbol: string): Promise<CompanyInfoCategory[]> {
    await this.reconnect();
    const market = get_stock_market(symbol) as number;
    const code = symbol.replace(/^(sh|sz|bj)/i, "");
    return getCompanyInfoCategory(this.client, market, code);
  }

  async F10(symbol: string, name: string): Promise<string | Record<string, string>> {
    await this.reconnect();
    const market = get_stock_market(symbol) as number;
    const code = symbol.replace(/^(sh|sz|bj)/i, "");
    const categories = await getCompanyInfoCategory(this.client, market, code);
    const found = categories.find((c) => c.name === name);
    if (!found) {
      const result: Record<string, string> = {};
      for (const cat of categories) {
        result[cat.name] = await getCompanyInfoContent(
          this.client, market, code, cat.filename, cat.start, cat.length,
        );
      }
      return result;
    }
    return getCompanyInfoContent(this.client, market, code, found.filename, found.start, found.length);
  }

  async xdxr(symbol: string): Promise<XdxrRecord[]> {
    await this.reconnect();
    const market = get_stock_market(symbol) as number;
    const code = symbol.replace(/^(sh|sz|bj)/i, "");
    return getXdXrInfo(this.client, market, code);
  }

  async finance(symbol: string): Promise<FinanceInfo> {
    await this.reconnect();
    const market = get_stock_market(symbol) as number;
    const code = symbol.replace(/^(sh|sz|bj)/i, "");
    return getFinanceInfo(this.client, market, code);
  }

  async k(symbol: string, begin: number, end: number): Promise<OhlcBar[]> {
    await this.reconnect();
    const market = get_stock_market(symbol) as number;
    const code = symbol.replace(/^(sh|sz|bj)/i, "");

    const first = Math.max(0, Math.floor(begin / 2.8) - 1);
    const last = Math.floor(end / 3.5) - 1;

    const [firstBars, lastBars] = await Promise.all([
      getSecurityBars(this.client, 4, market, code, first, MAX_KLINE_COUNT),
      getSecurityBars(this.client, 4, market, code, Math.max(0, last), MAX_KLINE_COUNT),
    ]);

    const allBars = [...firstBars, ...lastBars];
    // Deduplicate by date
    const seen = new Set<string>();
    const unique = allBars.filter((bar) => {
      if (seen.has(bar.date)) return false;
      seen.add(bar.date);
      return true;
    });

    // Sort by date and filter to range
    unique.sort((a, b) => a.date.localeCompare(b.date));
    const beginStr = String(begin);
    const endStr = String(end);
    return unique.filter((bar) => bar.date >= beginStr && bar.date <= endStr);
  }

  ohlc(symbol: string, begin: number, end: number): Promise<OhlcBar[]> {
    return this.k(symbol, begin, end);
  }

  async index(
    symbol: string,
    frequency: string | number = "days",
    start: number = 0,
    offset: number = MAX_KLINE_COUNT,
  ): Promise<OhlcBar[]> {
    return this.indexBars(symbol, frequency, start, offset);
  }

  async block(_tofile?: string): Promise<Buffer> {
    await this.reconnect();
    const blockFile = "block.dat";
    const meta = await getBlockInfoMeta(this.client, blockFile);
    const chunks: Buffer[] = [];
    const chunkSize = 30000;
    let offset = 0;
    while (offset < meta.size) {
      const size = Math.min(chunkSize, meta.size - offset);
      const chunk = await getBlockInfo(this.client, offset, size, blockFile);
      chunks.push(chunk);
      offset += chunkSize;
    }
    return Buffer.concat(chunks);
  }
}

async function retryOnEmpty<T>(
  fn: () => Promise<T>,
  isEmpty: (val: T) => boolean,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fn();
      if (!isEmpty(result)) return result;
      log.warn(`empty result on attempt ${attempt + 1}/${maxAttempts}`);
    } catch (err) {
      lastError = err;
      log.warn(`error on attempt ${attempt + 1}/${maxAttempts}: ${err}`);
    }
    if (attempt < maxAttempts - 1) {
      await randomWait();
    }
  }
  throw lastError ?? new Error("all retry attempts returned empty results");
}

export class ExtQuotes extends BaseQuotes {
  override async connect(): Promise<void> {
    const [addr, port] = await this.resolveServer("EX");
    this.bestip = [addr, port];
    await this.client.connect(addr, port);
    await this.client.sendRequest(0, EX_SETUP_CMD);
  }

  static validate(market: number | undefined, symbol: string): [number, string] {
    if (symbol.includes("#")) {
      const [m, c] = symbol.split("#");
      return [Number(m), c!];
    }
    if (market == null) {
      throw new Error("market is required when symbol is not in market#code format");
    }
    return [market, symbol];
  }

  async markets(): Promise<ReturnType<typeof getInstrumentCount>> {
    await this.reconnect();
    return retryOnEmpty(() => getInstrumentCount(this.client), (v) => v === 0);
  }

  async instrument(start: number = 0, offset: number = 100): Promise<ReturnType<typeof getInstrumentList>> {
    await this.reconnect();
    return retryOnEmpty(
      () => getInstrumentList(this.client, start, offset),
      (v) => v.length === 0,
    );
  }

  async instrumentCount(): Promise<number> {
    return this.markets();
  }

  async instruments(): Promise<ReturnType<typeof getInstrumentList>> {
    const count = await this.instrumentCount();
    return this.instrument(0, count);
  }

  async quote(market: number, symbol: string): Promise<ReturnType<typeof getInstrumentQuote>> {
    await this.reconnect();
    return retryOnEmpty(
      () => getInstrumentQuote(this.client, market, symbol),
      (v) => v.length === 0,
    );
  }

  async minute(market: number, symbol: string): Promise<MinuteData[]> {
    await this.reconnect();
    return retryOnEmpty(
      () => getMinuteTimeData(this.client, market, symbol),
      (v) => v.length === 0,
    );
  }

  async minutes(market: number, symbol: string, date: number): Promise<MinuteData[]> {
    await this.reconnect();
    return retryOnEmpty(
      () => getHistoryMinuteTimeData(this.client, market, symbol, date),
      (v) => v.length === 0,
    );
  }

  async bars(
    frequency: number,
    market: number,
    symbol: string,
    start: number = 0,
    offset: number = MAX_KLINE_COUNT,
  ): Promise<ReturnType<typeof getInstrumentBars>> {
    await this.reconnect();
    return retryOnEmpty(
      () => getInstrumentBars(this.client, frequency, market, symbol, start, offset),
      (v) => v.length === 0,
    );
  }

  async transaction(
    market: number,
    symbol: string,
    start: number = 0,
    offset: number = 2000,
  ): Promise<Transaction[]> {
    await this.reconnect();
    return retryOnEmpty(
      () => getTransactionData(this.client, market, symbol, start, offset),
      (v) => v.length === 0,
    );
  }

  async transactions(
    market: number,
    symbol: string,
    date: number,
    start: number = 0,
    offset: number = 2000,
  ): Promise<Transaction[]> {
    await this.reconnect();
    return retryOnEmpty(
      () => getHistoryTransactionData(this.client, market, symbol, start, offset, date),
      (v) => v.length === 0,
    );
  }
}

export type QuotesOptions = {
  bestip?: [string, number];
  timeout?: number;
  verbose?: boolean;
};

export async function quotes(
  market: "std" | "ext" = "std",
  _options?: QuotesOptions,
): Promise<StdQuotes | ExtQuotes> {
  const q = market === "ext" ? new ExtQuotes() : new StdQuotes();
  await q.connect();
  return q;
}
