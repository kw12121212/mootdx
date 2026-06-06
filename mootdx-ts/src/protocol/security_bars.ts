import type { OhlcBar } from "../types";
import { getDatetime, getPrice, getVolume } from "./helpers";
import type { TdxBaseApi } from "./base";

function calPrice1000(base: number, diff: number): number {
  return (base + diff) / 1000;
}

export function buildKlineRequest(
  category: number,
  market: number,
  code: string,
  start: number,
  count: number,
): Buffer {
  const codeBytes = Buffer.alloc(6, 0x20);
  Buffer.from(code).copy(codeBytes);

  const buf = Buffer.alloc(38);
  let offset = 0;

  buf.writeUInt16LE(0x010c, offset); offset += 2;
  buf.writeUInt32LE(0x01016408, offset); offset += 4;
  buf.writeUInt16LE(0x1c, offset); offset += 2;
  buf.writeUInt16LE(0x1c, offset); offset += 2;
  buf.writeUInt16LE(0x052d, offset); offset += 2;
  buf.writeUInt16LE(market, offset); offset += 2;
  codeBytes.copy(buf, offset); offset += 6;
  buf.writeUInt16LE(category, offset); offset += 2;
  buf.writeUInt16LE(1, offset); offset += 2;
  buf.writeUInt16LE(start, offset); offset += 2;
  buf.writeUInt16LE(count, offset); offset += 2;
  // 10 zero bytes: IIH
  buf.writeUInt32LE(0, offset); offset += 4;
  buf.writeUInt32LE(0, offset); offset += 4;
  buf.writeUInt16LE(0, offset);

  return buf;
}

export interface KlineBar extends OhlcBar {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function parseSecurityBarsResponse(
  body: Buffer,
  category: number,
): KlineBar[] {
  let pos = 0;
  const retCount = body.readUInt16LE(pos);
  pos += 2;

  const klines: KlineBar[] = [];
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
    });
  }

  return klines;
}

export async function getSecurityBars(
  api: TdxBaseApi,
  category: number,
  market: number,
  code: string,
  start: number,
  count: number,
): Promise<KlineBar[]> {
  const req = buildKlineRequest(category, market, code, start, count);
  const body = await api.sendRequest(0x052d, req);
  return parseSecurityBarsResponse(body, category);
}
