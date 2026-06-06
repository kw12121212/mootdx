export const MARKET_SZ = 0;
export const MARKET_SH = 1;
export const MARKET_BJ = 2;

export const KLINE_5MIN = 0;
export const KLINE_15MIN = 1;
export const KLINE_30MIN = 2;
export const KLINE_1HOUR = 3;
export const KLINE_DAILY = 4;
export const KLINE_WEEKLY = 5;
export const KLINE_MONTHLY = 6;
export const KLINE_EX_1MIN = 7;
export const KLINE_1MIN = 8;
export const KLINE_RI_K = 9;
export const KLINE_3MONTH = 10;
export const KLINE_YEARLY = 11;

export const MAX_TRANSACTION_COUNT = 2000;
export const MAX_KLINE_COUNT = 800;

export const FREQUENCY = [
  "5m",
  "15m",
  "30m",
  "1h",
  "day",
  "week",
  "mon",
  "ex_1m",
  "1m",
  "dk",
  "3mon",
  "year",
] as const;

export const BLOCK_SZ = "block_zs.dat";
export const BLOCK_FG = "block_fg.dat";
export const BLOCK_GN = "block_gn.dat";
export const BLOCK_DEFAULT = "block.dat";

export const TYPE_FLATS = 0;
export const TYPE_GROUP = 1;

export const HQ_HOSTS: readonly [string, string, number][] = [
  ["深圳双线主站1", "110.41.147.114", 7709],
  ["深圳双线主站2", "8.129.13.54", 7709],
  ["深圳双线主站3", "120.24.149.49", 7709],
  ["深圳双线主站4", "47.113.94.204", 7709],
  ["深圳双线主站5", "8.129.174.169", 7709],
  ["深圳双线主站6", "110.41.154.219", 7709],
  ["上海双线主站1", "124.70.176.52", 7709],
  ["上海双线主站2", "47.100.236.28", 7709],
  ["上海双线主站3", "101.133.214.242", 7709],
  ["上海双线主站4", "47.116.21.80", 7709],
  ["上海双线主站5", "47.116.105.28", 7709],
  ["上海双线主站6", "124.70.199.56", 7709],
  ["北京双线主站1", "121.36.54.217", 7709],
  ["北京双线主站2", "121.36.81.195", 7709],
  ["北京双线主站3", "123.249.15.60", 7709],
  ["广州双线主站1", "124.71.85.110", 7709],
  ["广州双线主站2", "139.9.51.18", 7709],
  ["广州双线主站3", "139.159.239.163", 7709],
  ["上海双线主站7", "106.14.201.131", 7709],
  ["上海双线主站8", "106.14.190.242", 7709],
  ["上海双线主站9", "121.36.225.169", 7709],
  ["上海双线主站10", "123.60.70.228", 7709],
  ["上海双线主站11", "123.60.73.44", 7709],
  ["上海双线主站12", "124.70.133.119", 7709],
  ["上海双线主站13", "124.71.187.72", 7709],
  ["上海双线主站14", "124.71.187.122", 7709],
  ["武汉电信主站1", "119.97.185.59", 7709],
  ["深圳双线主站7", "47.107.64.168", 7709],
  ["北京双线主站4", "124.70.75.113", 7709],
  ["广州双线主站4", "124.71.9.153", 7709],
  ["上海双线主站15", "123.60.84.66", 7709],
  ["深圳双线主站8", "47.107.228.47", 7719],
  ["北京双线主站5", "120.46.186.223", 7709],
  ["北京双线主站6", "124.70.22.210", 7709],
  ["北京双线主站7", "139.9.133.247", 7709],
  ["广州双线主站5", "116.205.163.254", 7709],
  ["广州双线主站6", "116.205.171.132", 7709],
  ["广州双线主站7", "116.205.183.150", 7709],
];

export const EX_HOSTS: readonly [string, string, number][] = [
  ["银河阿里云扩展行情", "47.112.95.207", 7720],
  ["银河杭州电信扩展行情", "218.75.75.18", 7720],
  ["银河武汉电信扩展行情", "58.49.110.76", 7720],
];

export const GP_HOSTS: readonly [string, string, number][] = [
  ["默认财务数据线路", "120.76.152.87", 7709],
];

export const CONFIG = {
  SERVER: { HQ: HQ_HOSTS, EX: EX_HOSTS, GP: GP_HOSTS },
  BESTIP: { HQ: "", EX: "", GP: "" },
  TDXDIR: "C:/new_tdx",
} as const;
