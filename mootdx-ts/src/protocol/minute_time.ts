import type { MinuteData } from "../types";
import { getPrice } from "./helpers";
import type { TdxBaseApi } from "./base";

export function buildMinuteTimeRequest(market: number, code: string): Buffer {
  const codeBytes = Buffer.alloc(6, 0x20);
  Buffer.from(code).copy(codeBytes);

  const buf = Buffer.alloc(18);
  let offset = 0;

  buf.writeUInt16LE(0x010c, offset); offset += 2;
  buf.writeUInt32LE(0x01080b1c, offset); offset += 4;
  buf.writeUInt16LE(0x0e, offset); offset += 2;
  buf.writeUInt16LE(0x0e, offset); offset += 2;
  buf.writeUInt16LE(0x051d, offset); offset += 2;
  buf.writeUInt16LE(market, offset); offset += 2;
  codeBytes.copy(buf, offset); offset += 6;
  buf.writeUInt32LE(0, offset);

  return buf;
}

export function parseMinuteTimeResponse(body: Buffer): MinuteData[] {
  let pos = 0;
  const num = body.readUInt16LE(pos);
  pos += 2;
  // skip 2 unknown bytes
  pos += 2;

  const results: MinuteData[] = [];
  let lastPrice = 0;

  for (let i = 0; i < num; i++) {
    const [priceDiff, p1] = getPrice(body, pos); pos = p1;
    const [, p2] = getPrice(body, pos); pos = p2; // reversed1 (reserved)
    const [vol, p3] = getPrice(body, pos); pos = p3;

    lastPrice += priceDiff;
    results.push({
      price: lastPrice / 100,
      vol,
    });
  }

  return results;
}

export async function getMinuteTimeData(
  api: TdxBaseApi,
  market: number,
  code: string,
): Promise<MinuteData[]> {
  const req = buildMinuteTimeRequest(market, code);
  const body = await api.sendRequest(0x051d, req);
  return parseMinuteTimeResponse(body);
}

export function buildHistoryMinuteTimeRequest(
  market: number,
  code: string,
  date: number,
): Buffer {
  const codeBytes = Buffer.alloc(6, 0x20);
  Buffer.from(code).copy(codeBytes);

  const buf = Buffer.alloc(17);
  let offset = 0;

  buf.writeUInt32LE(date, offset); offset += 4;
  buf.writeUInt16LE(0x010c, offset); offset += 2;
  buf.writeUInt16LE(0x0d, offset); offset += 2;
  buf.writeUInt16LE(0x0d, offset); offset += 2;
  buf.writeUInt16LE(0x0fb4, offset); offset += 2;
  buf.writeUInt8(market, offset); offset += 1;
  codeBytes.copy(buf, offset);

  return buf;
}

export function parseHistoryMinuteTimeResponse(body: Buffer): MinuteData[] {
  let pos = 0;
  const num = body.readUInt16LE(pos);
  pos += 2;
  // skip 4 unknown bytes
  pos += 4;

  const results: MinuteData[] = [];
  let lastPrice = 0;

  for (let i = 0; i < num; i++) {
    const [priceDiff, p1] = getPrice(body, pos); pos = p1;
    const [, p2] = getPrice(body, pos); pos = p2; // reversed1 (reserved)
    const [vol, p3] = getPrice(body, pos); pos = p3;

    lastPrice += priceDiff;
    results.push({
      price: lastPrice / 100,
      vol,
    });
  }

  return results;
}

export async function getHistoryMinuteTimeData(
  api: TdxBaseApi,
  market: number,
  code: string,
  date: number,
): Promise<MinuteData[]> {
  const req = buildHistoryMinuteTimeRequest(market, code, date);
  const body = await api.sendRequest(0x0fb4, req);
  return parseHistoryMinuteTimeResponse(body);
}
