export const enum Market {
  SZ = 0,
  SH = 1,
  BJ = 2,
}

export const enum KlineType {
  KLINE_5MIN = 0,
  KLINE_15MIN = 1,
  KLINE_30MIN = 2,
  KLINE_1HOUR = 3,
  KLINE_DAILY = 4,
  KLINE_WEEKLY = 5,
  KLINE_MONTHLY = 6,
  KLINE_EX_1MIN = 7,
  KLINE_1MIN = 8,
  KLINE_RI_K = 9,
  KLINE_3MONTH = 10,
  KLINE_YEARLY = 11,
}

export type Frequency =
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "days"
  | "week"
  | "mon"
  | "ex_1m"
  | "1m"
  | "day"
  | "3mon"
  | "year";

export interface OhlcBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  amount: number;
  code?: string;
}

export interface QuoteLevel {
  price: number;
  volume: number;
}

export interface Quote {
  market: number;
  code: string;
  active: number;
  price: number;
  lastClose: number;
  open: number;
  high: number;
  low: number;
  servertime: number;
  vol: number;
  curVol: number;
  amount: number;
  sVol: number;
  bVol: number;
  bid1: QuoteLevel;
  bid2: QuoteLevel;
  bid3: QuoteLevel;
  bid4: QuoteLevel;
  bid5: QuoteLevel;
  ask1: QuoteLevel;
  ask2: QuoteLevel;
  ask3: QuoteLevel;
  ask4: QuoteLevel;
  ask5: QuoteLevel;
}

export interface XdxrRecord {
  year: number;
  month: number;
  day: number;
  category: number;
  fenhong: number | null;
  peigujia: number | null;
  songzhuangu: number | null;
  peigu: number | null;
  suogu: number | null;
  panqianliutong: number | null;
  panhouliutong: number | null;
  qianzongguben: number | null;
  houzongguben: number | null;
  fenshu: number | null;
  xingquanjia: number | null;
}

export interface FinanceInfo {
  [key: string]: string | number;
}

export interface MinuteData {
  price: number;
  vol: number;
}

export interface Transaction {
  time: string;
  price: number;
  vol: number;
  num: number;
  buyOrSell: number;
}

export interface SecurityInfo {
  market: number;
  code: string;
  name: string;
}

export interface BlockInfo {
  blockType: number;
  code: string;
  name: string;
}

export interface FactorRecord {
  date: string;
  qfq: number;
  hfq: number;
}

export interface FinancialFile {
  filename: string;
  hash: string;
  filesize: number;
}

export interface CompanyInfoCategory {
  name: string;
  filename: string;
  start: number;
  length: number;
}

export interface MarketInfo {
  market: number;
  name: string;
}

export interface ServerHost {
  name: string;
  ip: string;
  port: number;
}
