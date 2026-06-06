import type { FactorRecord, OhlcBar, XdxrRecord } from "../types";

// --- Factor-based reversion (uses Sina Finance pre-computed factors) ---

export function factorReversion(
  data: OhlcBar[],
  factorData: FactorRecord[],
  method: string = "qfq",
): OhlcBar[] {
  if (!factorData || factorData.length === 0) return data;

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const sortedFactor = [...factorData].sort((a, b) => a.date.localeCompare(b.date));

  // Build a date->factor map
  const factorMap = new Map<string, number>();
  for (const f of sortedFactor) {
    const val = method === "qfq" ? f.qfq : f.hfq;
    factorMap.set(f.date, val);
  }

  if (sorted.length === 0) return data;

  // Fill factor values: forward-fill for hfq, backfill for qfq
  const factors: number[] = new Array(sorted.length).fill(1);
  let lastKnownFactor = 1;

  if (method === "qfq") {
    // Backfill: iterate from end to start
    for (let i = sorted.length - 1; i >= 0; i--) {
      const f = factorMap.get(sorted[i]!.date);
      if (f !== undefined) lastKnownFactor = f;
      factors[i] = lastKnownFactor;
    }
  } else {
    // Forward fill for hfq
    for (let i = 0; i < sorted.length; i++) {
      const f = factorMap.get(sorted[i]!.date);
      if (f !== undefined) lastKnownFactor = f;
      factors[i] = lastKnownFactor;
    }
  }

  return sorted.map((bar, i) => {
    const factor = factors[i]!;
    return {
      ...bar,
      open: bar.open * factor,
      high: bar.high * factor,
      low: bar.low * factor,
      close: bar.close * factor,
    };
  });
}

// --- Dividend/split-based reversion ---

interface AdjustmentRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  amount: number;
  if_trade: number;
  fenhong: number;
  peigu: number;
  peigujia: number;
  songzhuangu: number;
  category: number;
}

export function dividendReversion(
  bfqData: OhlcBar[],
  xdxrData: XdxrRecord[],
  type_: string = "qfq",
): OhlcBar[] {
  if (!xdxrData || xdxrData.length <= 0) return bfqData;

  // Filter to category 1 (dividend records)
  const info = xdxrData.filter((r) => r.category === 1);
  if (info.length === 0) return bfqData;

  const sorted = [...bfqData].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return bfqData;

  // Build adjustment rows
  const rows: AdjustmentRow[] = sorted.map((bar) => ({
    date: bar.date,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    vol: bar.vol,
    amount: bar.amount,
    if_trade: 1,
    fenhong: 0,
    peigu: 0,
    peigujia: 0,
    songzhuangu: 0,
    category: 0,
  }));

  // Merge dividend data into rows
  const infoByDate = new Map<string, XdxrRecord>();
  for (const rec of info) {
    const dateStr = `${rec.year}-${String(rec.month).padStart(2, "0")}-${String(rec.day).padStart(2, "0")}`;
    infoByDate.set(dateStr, rec);
  }

  for (const row of rows) {
    const rec = infoByDate.get(row.date);
    if (rec) {
      row.fenhong = rec.fenhong ?? 0;
      row.peigu = rec.peigu ?? 0;
      row.peigujia = rec.peigujia ?? 0;
      row.songzhuangu = rec.songzhuangu ?? 0;
      row.category = rec.category;
    }
  }

  // Forward-fill if_trade and dividend fields
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]!.if_trade === 0) {
      rows[i]!.if_trade = rows[i - 1]!.if_trade;
    }
  }

  // Calculate preclose
  const precloses: number[] = new Array(rows.length).fill(0);
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]!;
    const cur = rows[i]!;
    precloses[i] =
      (prev.close * 10 - cur.fenhong + cur.peigu * cur.peigujia) /
      (10 + cur.peigu + cur.songzhuangu);
  }
  precloses[0] = rows[0]!.close;

  // Calculate adjustment factor
  const adj: number[] = new Array(rows.length).fill(1);

  if (type_.toLowerCase() === "01" || type_.toLowerCase() === "qfq") {
    // Forward adjustment (qfq)
    for (let i = 0; i < rows.length - 1; i++) {
      if (rows[i + 1]!.close !== 0) {
        adj[i] = precloses[i + 1]! / rows[i + 1]!.close;
      }
    }
    // Reverse cumulative product
    let cumProd = 1;
    for (let i = rows.length - 1; i >= 0; i--) {
      cumProd *= adj[i]!;
      adj[i] = cumProd;
    }

    for (let i = 0; i < rows.length; i++) {
      rows[i]!.open *= adj[i]!;
      rows[i]!.high *= adj[i]!;
      rows[i]!.low *= adj[i]!;
      rows[i]!.close *= adj[i]!;
    }
  } else if (type_.toLowerCase() === "02" || type_.toLowerCase() === "hfq") {
    // Backward adjustment (hfq)
    let cumProd = 1;
    for (let i = 0; i < rows.length; i++) {
      if (i < rows.length - 1 && rows[i + 1]!.close !== 0) {
        adj[i] = precloses[i + 1]! / rows[i + 1]!.close;
      }
      cumProd *= adj[i]!;
      adj[i] = cumProd;
    }

    for (let i = 0; i < rows.length; i++) {
      rows[i]!.open /= adj[i]!;
      rows[i]!.high /= adj[i]!;
      rows[i]!.low /= adj[i]!;
      rows[i]!.close /= adj[i]!;
    }
  }

  // Adjust volume
  for (let i = 0; i < rows.length; i++) {
    rows[i]!.vol = rows[i]!.vol / adj[i]!;
  }

  // Filter: only trading days with non-zero open
  return rows
    .filter((r) => r.if_trade === 1 && r.open !== 0)
    .map((r) => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      vol: r.vol,
      amount: r.amount,
    }));
}

// --- ETF-specific reversion ---

export function etfReversion(
  data: OhlcBar[],
  xdxr: XdxrRecord[],
  adjust: string = "01",
): OhlcBar[] {
  if (!xdxr || xdxr.length <= 0) return data;

  // Filter to category 11 (ETF splits)
  const etfInfo = xdxr.filter((r) => r.category === 11);
  if (etfInfo.length <= 0) return data;

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  // Build suogu map
  const suoguMap = new Map<string, number>();
  for (const rec of etfInfo) {
    const dateStr = `${rec.year}-${String(rec.month).padStart(2, "0")}-${String(rec.day).padStart(2, "0")}`;
    suoguMap.set(dateStr, rec.suogu ?? 1);
  }

  if (adjust.toLowerCase() === "01" || adjust.toLowerCase() === "qfq") {
    // Backfill suogu, then shift forward
    let lastSuogu = 1;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const s = suoguMap.get(sorted[i]!.date);
      if (s !== undefined) lastSuogu = s;
      // Shift: apply to previous bars
      if (i > 0) {
        const factor = lastSuogu;
        sorted[i - 1]!.open /= factor;
        sorted[i - 1]!.high /= factor;
        sorted[i - 1]!.low /= factor;
        sorted[i - 1]!.close /= factor;
      }
    }
  } else if (adjust.toLowerCase() === "02" || adjust.toLowerCase() === "hfq") {
    // Forward fill suogu
    let lastSuogu = 1;
    for (let i = 0; i < sorted.length; i++) {
      const s = suoguMap.get(sorted[i]!.date);
      if (s !== undefined) lastSuogu = s;
      sorted[i]!.open *= lastSuogu;
      sorted[i]!.high *= lastSuogu;
      sorted[i]!.low *= lastSuogu;
      sorted[i]!.close *= lastSuogu;
    }
  }

  return sorted;
}

// --- Brute-force forward adjustment ---

export function baoliQfq(
  bars: OhlcBar[],
  xdxr: XdxrRecord[],
): OhlcBar[] {
  const result = bars.map((b) => ({ ...b }));

  for (const rec of xdxr) {
    const fh = rec.fenhong ?? 0;
    const pg = rec.peigu ?? 0;
    const pgj = rec.peigujia ?? 0;
    const szg = rec.songzhuangu ?? 0;
    const dateStr = `${rec.year}-${String(rec.month).padStart(2, "0")}-${String(rec.day).padStart(2, "0")}`;

    for (const bar of result) {
      if (bar.date < dateStr) {
        bar.close = (bar.close * 10 - fh + pg * pgj) / (10 + pg + szg);
        bar.open = (bar.open * 10 - fh + pg * pgj) / (10 + pg + szg);
        bar.high = (bar.high * 10 - fh + pg * pgj) / (10 + pg + szg);
        bar.low = (bar.low * 10 - fh + pg * pgj) / (10 + pg + szg);
      }
    }
  }

  return result;
}

// --- Main dispatcher ---

export function reversion(
  symbol: string,
  stockData: OhlcBar[],
  xdxr: XdxrRecord[],
  type_: string = "01",
  factorData: FactorRecord[] = [],
): OhlcBar[] {
  const code = symbol.replace(/^(sh|sz|bj)/i, "");

  // ETF symbols: 15xx, 16xx, 50xx, 51xx
  if (["15", "16", "50", "51"].includes(code.slice(0, 2))) {
    return etfReversion(stockData, xdxr, type_);
  }

  // Apply dividend reversion then factor reversion
  let result = dividendReversion(stockData, xdxr, type_);
  result = factorReversion(result, factorData, type_);
  return result;
}
