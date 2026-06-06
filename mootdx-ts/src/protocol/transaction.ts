import type { Transaction } from "../types";
import { getPrice, getTime } from "./helpers";
import type { TdxBaseApi } from "./base";

export function buildTransactionRequest(
  market: number,
  code: string,
  start: number,
  count: number,
): Buffer {
  const codeBytes = Buffer.alloc(6, 0x20);
  Buffer.from(code).copy(codeBytes);

  const buf = Buffer.alloc(22);
  let offset = 0;

  buf.writeUInt16LE(0x010c, offset); offset += 2;
  buf.writeUInt32LE(0x0108170c, offset); offset += 4;
  buf.writeUInt16LE(0x0e, offset); offset += 2;
  buf.writeUInt16LE(0x0e, offset); offset += 2;
  buf.writeUInt16LE(0x0fc5, offset); offset += 2;
  buf.writeUInt16LE(market, offset); offset += 2;
  codeBytes.copy(buf, offset); offset += 6;
  buf.writeUInt16LE(start, offset); offset += 2;
  buf.writeUInt16LE(count, offset);

  return buf;
}

export function parseTransactionResponse(body: Buffer): Transaction[] {
  let pos = 0;
  const num = body.readUInt16LE(pos);
  pos += 2;

  const results: Transaction[] = [];
  let lastPrice = 0;

  for (let i = 0; i < num; i++) {
    const [hour, minute, p0] = getTime(body, pos); pos = p0;
    const [priceDiff, p1] = getPrice(body, pos); pos = p1;
    const [vol, p2] = getPrice(body, pos); pos = p2;
    const [tradeNum, p3] = getPrice(body, pos); pos = p3;
    const [buyOrSell, p4] = getPrice(body, pos); pos = p4;
    const [, p5] = getPrice(body, pos); pos = p5; // unknown reserved

    lastPrice += priceDiff;
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");

    results.push({
      time: `${hh}:${mm}`,
      price: lastPrice / 100,
      vol,
      num: tradeNum,
      buyOrSell,
    });
  }

  return results;
}

export async function getTransactionData(
  api: TdxBaseApi,
  market: number,
  code: string,
  start: number,
  count: number,
): Promise<Transaction[]> {
  const req = buildTransactionRequest(market, code, start, count);
  const body = await api.sendRequest(0x0fc5, req);
  return parseTransactionResponse(body);
}

export function buildHistoryTransactionRequest(
  market: number,
  code: string,
  start: number,
  count: number,
  date: number,
): Buffer {
  const codeBytes = Buffer.alloc(6, 0x20);
  Buffer.from(code).copy(codeBytes);

  const buf = Buffer.alloc(26);
  let offset = 0;

  buf.writeUInt32LE(date, offset); offset += 4;
  buf.writeUInt16LE(0x010c, offset); offset += 2;
  buf.writeUInt16LE(0x12, offset); offset += 2;
  buf.writeUInt16LE(0x12, offset); offset += 2;
  buf.writeUInt16LE(0x0fb5, offset); offset += 2;
  buf.writeUInt16LE(market, offset); offset += 2;
  codeBytes.copy(buf, offset); offset += 6;
  buf.writeUInt16LE(start, offset); offset += 2;
  buf.writeUInt16LE(count, offset);

  return buf;
}

export function parseHistoryTransactionResponse(body: Buffer): Transaction[] {
  let pos = 0;
  const num = body.readUInt16LE(pos);
  pos += 2;
  // skip 4 unknown bytes
  pos += 4;

  const results: Transaction[] = [];
  let lastPrice = 0;

  for (let i = 0; i < num; i++) {
    const [hour, minute, p0] = getTime(body, pos); pos = p0;
    const [priceDiff, p1] = getPrice(body, pos); pos = p1;
    const [vol, p2] = getPrice(body, pos); pos = p2;
    const [buyOrSell, p3] = getPrice(body, pos); pos = p3;
    const [, p4] = getPrice(body, pos); pos = p4; // unknown reserved

    lastPrice += priceDiff;
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");

    results.push({
      time: `${hh}:${mm}`,
      price: lastPrice / 100,
      vol,
      num: 0,
      buyOrSell,
    });
  }

  return results;
}

export async function getHistoryTransactionData(
  api: TdxBaseApi,
  market: number,
  code: string,
  start: number,
  count: number,
  date: number,
): Promise<Transaction[]> {
  const req = buildHistoryTransactionRequest(market, code, start, count, date);
  const body = await api.sendRequest(0x0fb5, req);
  return parseHistoryTransactionResponse(body);
}
