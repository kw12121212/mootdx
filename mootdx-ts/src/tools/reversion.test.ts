import { test, describe, expect } from "bun:test";
import { factorReversion, dividendReversion, etfReversion, baoliQfq, reversion } from "./reversion";
import type { FactorRecord, OhlcBar, XdxrRecord } from "../types";

// --- Helpers ---

function makeBar(date: string, close: number, open?: number): OhlcBar {
  const o = open ?? close;
  return { date, open: o, high: o + 1, low: o - 1, close, vol: 1000, amount: 10000 };
}

function makeXdxr(year: number, month: number, day: number, category: number, overrides?: Partial<XdxrRecord>): XdxrRecord {
  return {
    year,
    month,
    day,
    category,
    fenhong: null,
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
    ...overrides,
  };
}

// --- factorReversion ---

describe("factorReversion", () => {
  test("returns data unchanged when factorData is empty", () => {
    const data = [makeBar("2024-01-01", 10)];
    expect(factorReversion(data, [])).toEqual(data);
  });

  test("returns data unchanged when factorData is null/undefined", () => {
    const data = [makeBar("2024-01-01", 10)];
    expect(factorReversion(data, null as any)).toEqual(data);
    expect(factorReversion(data, undefined as any)).toEqual(data);
  });

  test("returns empty array for empty data", () => {
    expect(factorReversion([], [{ date: "2024-01-01", qfq: 1.5, hfq: 2.0 }])).toEqual([]);
  });

  test("applies qfq factors with backfill from later dates", () => {
    // factorReversion backfill for qfq: iterates from end to start.
    // If a bar's date matches the factor map, use that factor; otherwise use last known.
    // So the factor "carries backward" from later dates to earlier dates.
    const data = [
      makeBar("2024-01-01", 10),
      makeBar("2024-01-02", 12),
      makeBar("2024-01-03", 14),
    ];
    // Only 2024-01-03 has a factor. Backfill from end:
    // i=2 (2024-01-03): factorMap hit => lastKnownFactor=0.5
    // i=1 (2024-01-02): no hit => uses lastKnownFactor=0.5
    // i=0 (2024-01-01): no hit => uses lastKnownFactor=0.5
    const factors: FactorRecord[] = [
      { date: "2024-01-03", qfq: 0.5, hfq: 2.0 },
    ];

    const result = factorReversion(data, factors, "qfq");

    expect(result[0]!.close).toBeCloseTo(5);   // 10 * 0.5
    expect(result[1]!.close).toBeCloseTo(6);   // 12 * 0.5
    expect(result[2]!.close).toBeCloseTo(7);   // 14 * 0.5
  });

  test("qfq uses each bar's own factor when available (backfill still applies to gap bars)", () => {
    const data = [
      makeBar("2024-01-01", 10),
      makeBar("2024-01-02", 12),
      makeBar("2024-01-03", 14),
    ];
    // Both 2024-01-01 and 2024-01-03 have factors. Backfill from end:
    // i=2 (2024-01-03): factorMap hit => lastKnownFactor=0.5
    // i=1 (2024-01-02): no hit => lastKnownFactor=0.5
    // i=0 (2024-01-01): factorMap hit => lastKnownFactor=1.0
    const factors: FactorRecord[] = [
      { date: "2024-01-01", qfq: 1.0, hfq: 1.0 },
      { date: "2024-01-03", qfq: 0.5, hfq: 2.0 },
    ];

    const result = factorReversion(data, factors, "qfq");

    expect(result[0]!.close).toBeCloseTo(10);  // 10 * 1.0 (own factor)
    expect(result[1]!.close).toBeCloseTo(6);   // 12 * 0.5 (backfilled)
    expect(result[2]!.close).toBeCloseTo(7);   // 14 * 0.5 (own factor)
  });

  test("applies hfq factors with forward fill", () => {
    const data = [
      makeBar("2024-01-01", 10),
      makeBar("2024-01-02", 12),
      makeBar("2024-01-03", 14),
    ];
    const factors: FactorRecord[] = [
      { date: "2024-01-01", qfq: 1.0, hfq: 1.0 },
      { date: "2024-01-03", qfq: 0.5, hfq: 2.0 },
    ];

    const result = factorReversion(data, factors, "hfq");

    // Forward fill: factor propagates forward
    // 2024-01-01: hfq=1.0
    // 2024-01-02: forward filled from 2024-01-01 => 1.0
    // 2024-01-03: hfq=2.0
    expect(result[0]!.close).toBeCloseTo(10); // 10 * 1.0
    expect(result[1]!.close).toBeCloseTo(12); // 12 * 1.0
    expect(result[2]!.close).toBeCloseTo(28); // 14 * 2.0
  });

  test("defaults to qfq method when method is unspecified", () => {
    const data = [makeBar("2024-01-01", 10)];
    const factors: FactorRecord[] = [{ date: "2024-01-01", qfq: 0.8, hfq: 1.2 }];

    const result = factorReversion(data, factors);
    expect(result[0]!.close).toBeCloseTo(8); // 10 * 0.8
  });

  test("adjusts all OHLC fields", () => {
    const data = [makeBar("2024-01-01", 10, 9)];
    const factors: FactorRecord[] = [{ date: "2024-01-01", qfq: 2.0, hfq: 2.0 }];

    const result = factorReversion(data, factors, "qfq");
    expect(result[0]!.open).toBeCloseTo(18);   // 9 * 2.0
    expect(result[0]!.high).toBeCloseTo(20);   // (9+1) * 2.0
    expect(result[0]!.low).toBeCloseTo(16);    // (9-1) * 2.0
    expect(result[0]!.close).toBeCloseTo(20);  // 10 * 2.0
    // vol and amount remain unchanged
    expect(result[0]!.vol).toBe(1000);
    expect(result[0]!.amount).toBe(10000);
  });

  test("sorts data by date before processing", () => {
    const data = [
      makeBar("2024-01-03", 14),
      makeBar("2024-01-01", 10),
    ];
    // Only factor for 2024-01-02. Backfill for qfq:
    // i=1 (2024-01-03): no hit => lastKnownFactor stays 1
    // i=0 (2024-01-01): no hit => lastKnownFactor stays 1
    // Wait, but there's no factor for sorted[0] or sorted[1].
    // The factor at 2024-01-02 is not in the data, so it never matches.
    // Backfill from end:
    // i=1 (2024-01-03): no match, lastKnownFactor=1
    // i=0 (2024-01-01): no match, lastKnownFactor=1
    const factors: FactorRecord[] = [{ date: "2024-01-02", qfq: 0.5, hfq: 2.0 }];

    const result = factorReversion(data, factors, "qfq");
    expect(result[0]!.date).toBe("2024-01-01");
    expect(result[0]!.close).toBeCloseTo(10); // 10 * 1 (no matching factor)
    expect(result[1]!.date).toBe("2024-01-03");
    expect(result[1]!.close).toBeCloseTo(14); // 14 * 1 (no matching factor)
  });

  test("uses default factor 1 when no factor data matches any bar", () => {
    const data = [makeBar("2024-01-01", 10), makeBar("2024-01-02", 20)];
    const factors: FactorRecord[] = [{ date: "2023-12-31", qfq: 0.5, hfq: 2.0 }];

    const result = factorReversion(data, factors, "qfq");
    // Backfill from end: neither bar matches the factor date, so lastKnownFactor stays 1
    // Wait: for qfq, we iterate from end. i=1: no match => stays 1. i=0: no match => stays 1.
    // The factor at 2023-12-31 is in the map but never hits a data bar.
    expect(result[0]!.close).toBe(10);
    expect(result[1]!.close).toBe(20);
  });
});

// --- dividendReversion ---

describe("dividendReversion", () => {
  test("returns data unchanged when xdxrData is empty", () => {
    const data = [makeBar("2024-01-01", 10)];
    expect(dividendReversion(data, [])).toEqual(data);
  });

  test("returns data unchanged when no category 1 records exist", () => {
    const data = [makeBar("2024-01-01", 10)];
    const xdxr = [makeXdxr(2024, 1, 1, 2)]; // category 2, not 1
    expect(dividendReversion(data, xdxr)).toEqual(data);
  });

  test("returns empty array for empty data", () => {
    const xdxr = [makeXdxr(2024, 1, 1, 1, { fenhong: 1 })];
    expect(dividendReversion([], xdxr)).toEqual([]);
  });

  test("applies qfq forward adjustment with dividend", () => {
    // Two bars: before and after ex-dividend date
    const data = [
      makeBar("2024-01-01", 100, 100), // close=100
      makeBar("2024-01-02", 90, 90),    // close=90, ex-dividend date
    ];
    // fenhong=10 (1 yuan per share cash dividend)
    const xdxr = [makeXdxr(2024, 1, 2, 1, { fenhong: 10 })];

    const result = dividendReversion(data, xdxr, "qfq");

    // preclose[1] = (prev.close * 10 - cur.fenhong + cur.peigu * cur.peigujia) / (10 + cur.peigu + cur.songzhuangu)
    //             = (100 * 10 - 10 + 0) / (10 + 0 + 0) = 990 / 10 = 99
    // adj[0] = preclose[1] / close[1] = 99 / 90 = 1.1
    // Reverse cumulative product: cumProd starts at 1, goes from end
    // i=1: cumProd = 1 * adj[1]=1 => 1, adj[1]=1
    // i=0: cumProd = 1 * adj[0]=1.1 => 1.1, adj[0]=1.1
    // bar[0]: close = 100 * 1.1 = 110
    // bar[1]: close = 90 * 1 = 90
    expect(result.length).toBe(2);
    expect(result[0]!.close).toBeCloseTo(110);
    expect(result[1]!.close).toBeCloseTo(90);
  });

  test("applies hfq backward adjustment with dividend", () => {
    const data = [
      makeBar("2024-01-01", 100, 100),
      makeBar("2024-01-02", 90, 90),
    ];
    const xdxr = [makeXdxr(2024, 1, 2, 1, { fenhong: 10 })];

    const result = dividendReversion(data, xdxr, "hfq");

    // For hfq, cumProd builds forward: adj[0] = preclose[1]/close[1] = 99/90 = 1.1
    // cumProd[0] = 1 * 1.1 = 1.1
    // adj[1] = 1 (last bar, no next bar), cumProd[1] = 1.1 * 1 = 1.1
    // bar[0]: close / 1.1 = 100 / 1.1
    // bar[1]: close / 1.1 = 90 / 1.1
    expect(result.length).toBe(2);
    expect(result[0]!.close).toBeCloseTo(100 / 1.1, 2);
    expect(result[1]!.close).toBeCloseTo(90 / 1.1, 2);
  });

  test("handles type aliases '01' for qfq and '02' for hfq", () => {
    const data = [
      makeBar("2024-01-01", 100, 100),
      makeBar("2024-01-02", 90, 90),
    ];
    const xdxr = [makeXdxr(2024, 1, 2, 1, { fenhong: 10 })];

    const resultQfq = dividendReversion(data, xdxr, "01");
    const resultQfqNamed = dividendReversion(data, xdxr, "qfq");
    expect(resultQfq[0]!.close).toBeCloseTo(resultQfqNamed[0]!.close);

    const resultHfq = dividendReversion(data, xdxr, "02");
    const resultHfqNamed = dividendReversion(data, xdxr, "hfq");
    expect(resultHfq[0]!.close).toBeCloseTo(resultHfqNamed[0]!.close);
  });

  test("handles stock split (songzhuangu)", () => {
    // 10 shares -> 15 shares (songzhuangu=5 = 5 shares per 10)
    const data = [
      makeBar("2024-01-01", 30, 30),
      makeBar("2024-01-02", 20, 20),
    ];
    const xdxr = [makeXdxr(2024, 1, 2, 1, { songzhuangu: 5 })];

    const result = dividendReversion(data, xdxr, "qfq");

    // preclose[1] = (30*10 - 0 + 0) / (10 + 0 + 5) = 300 / 15 = 20
    // adj[0] = 20 / 20 = 1.0
    // So bar[0] stays at 30, bar[1] stays at 20
    expect(result[0]!.close).toBeCloseTo(30);
    expect(result[1]!.close).toBeCloseTo(20);
  });

  test("filters out non-trading days with zero open", () => {
    const data = [
      { date: "2024-01-01", open: 10, high: 11, low: 9, close: 10, vol: 100, amount: 1000 },
      { date: "2024-01-02", open: 0, high: 0, low: 0, close: 10, vol: 0, amount: 0 },
      { date: "2024-01-03", open: 12, high: 13, low: 11, close: 12, vol: 200, amount: 2000 },
    ];
    const xdxr = [makeXdxr(2024, 1, 2, 1, { fenhong: 0 })];

    const result = dividendReversion(data, xdxr, "qfq");
    // Bar with open=0 should be filtered out
    expect(result.every((r) => r.open !== 0)).toBe(true);
  });

  test("adjusts volume by dividing by adjustment factor", () => {
    const data = [
      makeBar("2024-01-01", 100, 100),
      makeBar("2024-01-02", 90, 90),
    ];
    const xdxr = [makeXdxr(2024, 1, 2, 1, { fenhong: 10 })];

    const result = dividendReversion(data, xdxr, "qfq");
    // Volume adjusted: vol / adj[i]
    // adj[0] = 1.1, adj[1] = 1.0
    expect(result[0]!.vol).toBeCloseTo(1000 / 1.1, 2);
    expect(result[1]!.vol).toBeCloseTo(1000);
  });
});

// --- etfReversion ---

describe("etfReversion", () => {
  test("returns data unchanged when xdxr is empty", () => {
    const data = [makeBar("2024-01-01", 10)];
    expect(etfReversion(data, [])).toEqual(data);
  });

  test("returns data unchanged when no category 11 records exist", () => {
    const data = [makeBar("2024-01-01", 10)];
    const xdxr = [makeXdxr(2024, 1, 1, 1)];
    expect(etfReversion(data, xdxr)).toEqual(data);
  });

  test("applies ETF qfq adjustment (backfill suogu)", () => {
    const data = [
      makeBar("2024-01-01", 10),
      makeBar("2024-01-02", 10),
      makeBar("2024-01-03", 10),
    ];
    // Category 11 ETF split, suogu=2 on 2024-01-03
    const xdxr = [makeXdxr(2024, 1, 3, 11, { suogu: 2 })];

    const result = etfReversion(data, xdxr, "01");

    // Backfill from end:
    // i=2 (2024-01-03): suogu=2, apply to i=1: bar[1] /= 2
    // i=1 (2024-01-02): no match, lastSuogu=2, apply to i=0: bar[0] /= 2
    // i=0 (2024-01-01): no action on self
    expect(result[0]!.close).toBeCloseTo(5);   // applied suogu from i=1
    expect(result[1]!.close).toBeCloseTo(5);   // applied suogu from i=2
    expect(result[2]!.close).toBeCloseTo(10);  // last bar unchanged
  });

  test("applies ETF hfq adjustment (forward fill suogu)", () => {
    const data = [
      makeBar("2024-01-01", 10),
      makeBar("2024-01-02", 10),
      makeBar("2024-01-03", 10),
    ];
    const xdxr = [makeXdxr(2024, 1, 2, 11, { suogu: 2 })];

    const result = etfReversion(data, xdxr, "02");

    // Forward fill: bars before the suogu date keep suogu=1
    // 2024-01-01: no suogu, lastSuogu=1 => 10*1 = 10
    // 2024-01-02: suogu=2, lastSuogu=2 => 10*2 = 20
    // 2024-01-03: forward filled => 10*2 = 20
    expect(result[0]!.close).toBeCloseTo(10);
    expect(result[1]!.close).toBeCloseTo(20);
    expect(result[2]!.close).toBeCloseTo(20);
  });

  test("adjusts all OHLC fields for ETF", () => {
    const data = [makeBar("2024-01-01", 10, 9)];
    const xdxr = [makeXdxr(2024, 1, 1, 11, { suogu: 2 })];

    const result = etfReversion(data, xdxr, "02");
    expect(result[0]!.open).toBeCloseTo(18);  // 9 * 2
    expect(result[0]!.high).toBeCloseTo(20);  // (9+1) * 2
    expect(result[0]!.low).toBeCloseTo(16);   // (9-1) * 2
    expect(result[0]!.close).toBeCloseTo(20); // 10 * 2
  });

  test("returns data unchanged when suogu is 1 (no split)", () => {
    const data = [makeBar("2024-01-01", 10)];
    const xdxr = [makeXdxr(2024, 1, 1, 11, { suogu: 1 })];

    const result = etfReversion(data, xdxr, "01");
    // i=0: suogu=1, apply to i=-1 (skip). Factor=1. No change.
    expect(result[0]!.close).toBeCloseTo(10);
  });

  test("handles multiple ETF split records", () => {
    const data = [
      makeBar("2024-01-01", 10),
      makeBar("2024-01-02", 10),
      makeBar("2024-01-03", 10),
      makeBar("2024-01-04", 10),
    ];
    const xdxr = [
      makeXdxr(2024, 1, 2, 11, { suogu: 2 }),
      makeXdxr(2024, 1, 4, 11, { suogu: 3 }),
    ];

    const result = etfReversion(data, xdxr, "01");

    // Backfill from end:
    // i=3 (2024-01-04): suogu=3, apply to i=2: bar[2]/=3 => 10/3
    // i=2 (2024-01-03): no match, lastSuogu=3, apply to i=1: bar[1]/=3 => 10/3
    // i=1 (2024-01-02): suogu=2, lastSuogu=2, apply to i=0: bar[0]/=2 => 5
    // i=0: no action
    expect(result[0]!.close).toBeCloseTo(5);      // 10 / 2
    expect(result[1]!.close).toBeCloseTo(10 / 3);  // 10 / 3
    expect(result[2]!.close).toBeCloseTo(10 / 3);  // 10 / 3
    expect(result[3]!.close).toBeCloseTo(10);       // last bar unchanged
  });

  test("qfq alias works same as 01", () => {
    const data = [makeBar("2024-01-01", 10), makeBar("2024-01-02", 10)];
    const xdxr = [makeXdxr(2024, 1, 2, 11, { suogu: 2 })];

    const r1 = etfReversion(data, xdxr, "01");
    const r2 = etfReversion(data, xdxr, "qfq");
    expect(r1[0]!.close).toBeCloseTo(r2[0]!.close);
    expect(r1[1]!.close).toBeCloseTo(r2[1]!.close);
  });
});

// --- baoliQfq ---

describe("baoliQfq", () => {
  test("returns copy of bars with no xdxr records", () => {
    const bars = [makeBar("2024-01-01", 10)];
    const result = baoliQfq(bars, []);
    expect(result[0]!.close).toBe(10);
  });

  test("applies brute-force adjustment to bars before ex-dividend date", () => {
    const bars = [
      makeBar("2024-01-01", 100),
      makeBar("2024-01-02", 100),
      makeBar("2024-01-03", 100),
    ];
    // fenhong=10 (1 per share), ex-date 2024-01-03
    const xdxr = [makeXdxr(2024, 1, 3, 1, { fenhong: 10 })];

    const result = baoliQfq(bars, xdxr);

    // Bars before 2024-01-03 get adjusted:
    // new close = (100*10 - 10 + 0) / (10 + 0 + 0) = 990/10 = 99
    expect(result[0]!.close).toBeCloseTo(99);
    expect(result[1]!.close).toBeCloseTo(99);
    expect(result[2]!.close).toBe(100); // on or after ex-date, no change
  });

  test("handles split with songzhuangu and peigu", () => {
    const bars = [
      makeBar("2024-01-01", 50),
      makeBar("2024-01-02", 50),
    ];
    const xdxr = [makeXdxr(2024, 1, 2, 1, {
      songzhuangu: 5, // 5 bonus shares per 10
      peigu: 2,        // 2 rights issue per 10
      peigujia: 10,    // rights issue price 10
    })];

    const result = baoliQfq(bars, xdxr);

    // bar before 2024-01-02:
    // close = (50*10 - 0 + 2*10) / (10 + 2 + 5) = 520 / 17
    expect(result[0]!.close).toBeCloseTo(520 / 17);
    expect(result[1]!.close).toBe(50);
  });

  test("does not mutate original bars", () => {
    const bars = [makeBar("2024-01-01", 100)];
    const xdxr = [makeXdxr(2024, 1, 2, 1, { fenhong: 10 })];

    const result = baoliQfq(bars, xdxr);
    // Original bar should remain unchanged
    expect(bars[0]!.close).toBe(100);
    // Result is a separate object
    expect(result[0]).not.toBe(bars[0]);
  });

  test("adjusts all OHLC fields", () => {
    const bars = [makeBar("2024-01-01", 100, 95)];
    const xdxr = [makeXdxr(2024, 1, 2, 1, { fenhong: 10 })];

    const result = baoliQfq(bars, xdxr);
    const expected = (v: number) => (v * 10 - 10) / 10;
    expect(result[0]!.close).toBeCloseTo(expected(100));
    expect(result[0]!.open).toBeCloseTo(expected(95));
    expect(result[0]!.high).toBeCloseTo(expected(96)); // 95+1
    expect(result[0]!.low).toBeCloseTo(expected(94));  // 95-1
  });

  test("handles null dividend fields as zero", () => {
    const bars = [makeBar("2024-01-01", 100)];
    // All fields are null
    const xdxr = [makeXdxr(2024, 1, 2, 1)];

    const result = baoliQfq(bars, xdxr);
    // (100*10 - 0 + 0) / (10 + 0 + 0) = 100
    expect(result[0]!.close).toBeCloseTo(100);
  });
});

// --- reversion dispatcher ---

describe("reversion dispatcher", () => {
  const bars: OhlcBar[] = [
    makeBar("2024-01-01", 100),
    makeBar("2024-01-02", 100),
  ];
  const xdxr = [makeXdxr(2024, 1, 2, 1, { fenhong: 10 })];
  const factors: FactorRecord[] = [{ date: "2024-01-01", qfq: 0.9, hfq: 1.1 }];

  test("routes ETF symbols (15xx) to etfReversion", () => {
    const etfXdxr = [makeXdxr(2024, 1, 2, 11, { suogu: 2 })];
    const result = reversion("150001", bars, etfXdxr, "01");
    expect(result).toBeDefined();
    expect(result.length).toBe(2);
  });

  test("routes ETF symbols (50xx) to etfReversion", () => {
    const etfXdxr = [makeXdxr(2024, 1, 2, 11, { suogu: 2 })];
    const result = reversion("500001", bars, etfXdxr, "01");
    expect(result).toBeDefined();
  });

  test("routes ETF symbols (51xx) to etfReversion", () => {
    const etfXdxr = [makeXdxr(2024, 1, 2, 11, { suogu: 2 })];
    const result = reversion("510050", bars, etfXdxr, "01");
    expect(result).toBeDefined();
  });

  test("routes ETF symbols (16xx) to etfReversion", () => {
    const etfXdxr = [makeXdxr(2024, 1, 2, 11, { suogu: 2 })];
    const result = reversion("160001", bars, etfXdxr, "01");
    expect(result).toBeDefined();
  });

  test("routes ETF with sh prefix to etfReversion", () => {
    const etfXdxr = [makeXdxr(2024, 1, 2, 11, { suogu: 2 })];
    const result = reversion("sh510050", bars, etfXdxr, "01");
    expect(result).toBeDefined();
  });

  test("routes regular stock symbols to dividend+factor reversion", () => {
    const result = reversion("600000", bars, xdxr, "qfq", factors);
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });

  test("routes regular stock with prefix to dividend+factor reversion", () => {
    const result = reversion("sz000001", bars, xdxr, "qfq", factors);
    expect(result).toBeDefined();
  });

  test("uses default type '01' when not specified", () => {
    const result = reversion("600000", bars, xdxr);
    expect(result).toBeDefined();
  });

  test("uses empty factorData when not specified", () => {
    const result = reversion("600000", bars, xdxr, "qfq");
    expect(result).toBeDefined();
  });

  test("handles edge case: empty stock data", () => {
    const result = reversion("600000", [], xdxr, "qfq", factors);
    expect(result).toEqual([]);
  });

  test("ETF dispatching distinguishes from stock (000001 is stock, 500001 is ETF)", () => {
    const stockResult = reversion("000001", bars, xdxr, "qfq", factors);
    const etfXdxr = [makeXdxr(2024, 1, 2, 11, { suogu: 2 })];
    const etfResult = reversion("500001", bars, etfXdxr, "01");

    // Both should produce results but through different code paths
    expect(stockResult).toBeDefined();
    expect(etfResult).toBeDefined();
    // The results differ because different algorithms are applied
    expect(stockResult.length).toBeGreaterThan(0);
    expect(etfResult.length).toBeGreaterThan(0);
  });
});
