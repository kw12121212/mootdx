import type { Quote, QuoteLevel } from "../types";
import { getPrice } from "./helpers";
import type { TdxBaseApi } from "./base";

export function buildQuotesRequest(
  markets: number[],
  codes: string[],
): Buffer {
  const count = Math.min(markets.length, codes.length);
  // header(12) + stock_count(2) + per-stock: market(1) + code(6) = 14 + 7*count
  const buf = Buffer.alloc(14 + 7 * count);
  let offset = 0;

  buf.writeUInt16LE(0x010c, offset); offset += 2;
  buf.writeUInt32LE(0x800400, offset); offset += 4;
  buf.writeUInt16LE(2 + 7 * count, offset); offset += 2;
  buf.writeUInt16LE(2 + 7 * count, offset); offset += 2;
  buf.writeUInt16LE(0x053e, offset); offset += 2;

  buf.writeUInt16LE(count, offset); offset += 2;

  for (let i = 0; i < count; i++) {
    buf[offset] = markets[i]!;
    offset += 1;
    const codeBytes = Buffer.alloc(6, 0x20);
    Buffer.from(codes[i]!).copy(codeBytes);
    codeBytes.copy(buf, offset);
    offset += 6;
  }

  return buf;
}

export function parseQuotesResponse(body: Buffer): Quote[] {
  let pos = 0;
  const num = body.readUInt16LE(pos); pos += 2;

  const quotes: Quote[] = [];

  for (let i = 0; i < num; i++) {
    const market = body[pos]!;
    pos += 1;
    const code = body.subarray(pos, pos + 6).toString("ascii").replace(/\x00/g, "").trim();
    pos += 6;

    // active1(B) + active2(B)
    const active = body.readUInt16LE(pos); pos += 2;

    const [lastCloseDiff, p1] = getPrice(body, pos); pos = p1;
    const [priceOpenDiff, p2] = getPrice(body, pos); pos = p2;
    const [priceHighDiff, p3] = getPrice(body, pos); pos = p3;
    const [priceLowDiff, p4] = getPrice(body, pos); pos = p4;

    const lastClose = lastCloseDiff / 1000;
    const open = (lastCloseDiff + priceOpenDiff) / 1000;
    const high = (lastCloseDiff + priceHighDiff) / 1000;
    const low = (lastCloseDiff + priceLowDiff) / 1000;
    const price = lastClose;

    const servertime = body.readUInt32LE(pos); pos += 4;

    pos = getPrice(body, pos)[1]; // skip curVol diff
    const vol = body.readUInt32LE(pos); pos += 4;
    const curVol2 = body.readUInt32LE(pos); pos += 4;
    const amount = body.readUInt32LE(pos); pos += 4;
    const sVol = body.readUInt32LE(pos); pos += 4;
    const bVol = body.readUInt32LE(pos); pos += 4;

    const bidLevels: QuoteLevel[] = [];
    const askLevels: QuoteLevel[] = [];

    for (let j = 0; j < 5; j++) {
      const [bidPrice, bp] = getPrice(body, pos); pos = bp;
      bidLevels.push({ price: (lastCloseDiff + bidPrice) / 1000, volume: body.readUInt32LE(pos) });
      pos += 4;
    }

    for (let j = 0; j < 5; j++) {
      const [askPrice, ap] = getPrice(body, pos); pos = ap;
      askLevels.push({ price: (lastCloseDiff + askPrice) / 1000, volume: body.readUInt32LE(pos) });
      pos += 4;
    }

    quotes.push({
      market,
      code,
      active,
      price,
      lastClose,
      open,
      high,
      low,
      servertime,
      vol,
      curVol: curVol2,
      amount,
      sVol,
      bVol,
      bid1: bidLevels[0]!,
      bid2: bidLevels[1]!,
      bid3: bidLevels[2]!,
      bid4: bidLevels[3]!,
      bid5: bidLevels[4]!,
      ask1: askLevels[0]!,
      ask2: askLevels[1]!,
      ask3: askLevels[2]!,
      ask4: askLevels[3]!,
      ask5: askLevels[4]!,
    });
  }

  return quotes;
}

export async function getSecurityQuotes(
  api: TdxBaseApi,
  markets: number[],
  codes: string[],
): Promise<Quote[]> {
  const req = buildQuotesRequest(markets, codes);
  const body = await api.sendRequest(0x053e, req);
  return parseQuotesResponse(body);
}
