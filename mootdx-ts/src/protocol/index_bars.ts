import type { OhlcBar } from "../types";
import { getDatetime, getPrice, getVolume } from "./helpers";
import { buildKlineRequest } from "./security_bars";
import type { TdxBaseApi } from "./base";

function calPrice1000(base: number, diff: number): number {
  return (base + diff) / 1000;
}

export interface IndexBar extends OhlcBar {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  upCount: number;
  downCount: number;
}

export function parseIndexBarsResponse(
  body: Buffer,
  category: number,
): IndexBar[] {
  let pos = 0;
  const retCount = body.readUInt16LE(pos);
  pos += 2;

  const klines: IndexBar[] = [];
  let preDiffBase = 0;

  for (let i = 0; i < retCount; i++) {
    const [year, month, day, hour, minute, newPos] = getDatetime(body, pos, category);
    pos = newPos;

    let [priceOpenDiff, p1] = getPrice(body, pos); pos = p1;
    const [priceCloseDiff, p2] = getPrice(body, pos); pos = p2;
    const [priceHighDiff, p3] = getPrice(body, pos); pos = p3;
    const [priceLowDiff, p4] = getPrice(body, pos); pos = p4;

    const volRaw = body.readUInt32LE(pos); pos += 4;
    const vol = getVolume(volRaw);

    const dbvolRaw = body.readUInt32LE(pos); pos += 4;
    const amount = getVolume(dbvolRaw);

    const upCount = body.readUInt16LE(pos); pos += 2;
    const downCount = body.readUInt16LE(pos); pos += 2;

    const open = calPrice1000(priceOpenDiff, preDiffBase);
    priceOpenDiff = priceOpenDiff + preDiffBase;
    const close = calPrice1000(priceOpenDiff, priceCloseDiff);
    const high = calPrice1000(priceOpenDiff, priceHighDiff);
    const low = calPrice1000(priceOpenDiff, priceLowDiff);

    preDiffBase = priceOpenDiff + priceCloseDiff;

    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const hh = String(hour).padStart(2, "0");
    const mi = String(minute).padStart(2, "0");

    klines.push({
      date: `${year}-${mm}-${dd} ${hh}:${mi}`,
      open,
      close,
      high,
      low,
      vol,
      amount,
      year,
      month,
      day,
      hour,
      minute,
      upCount,
      downCount,
    });
  }

  return klines;
}

export async function getIndexBars(
  api: TdxBaseApi,
  category: number,
  market: number,
  code: string,
  start: number,
  count: number,
): Promise<IndexBar[]> {
  const req = buildKlineRequest(category, market, code, start, count);
  const body = await api.sendRequest(0x052d, req);
  return parseIndexBarsResponse(body, category);
}
