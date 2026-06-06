import type { OhlcBar } from "../../types";
import type { TdxBaseApi } from "../base";
import { getDatetime } from "../helpers";

export interface ExtBar extends OhlcBar {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  position: number;
  trade: number;
}

export function buildInstrumentBarsRequest(
  category: number,
  market: number,
  code: string,
  start: number,
  count: number,
): Buffer {
  const header = Buffer.from([
    0x01, 0x01, 0x08, 0x6a, 0x01, 0x01, 0x16, 0x00,
    0x16, 0x00,
  ]);
  const cmd = Buffer.from([0xff, 0x23]);

  const codeBytes = Buffer.alloc(9, 0);
  Buffer.from(code).copy(codeBytes);

  const params = Buffer.alloc(20);
  let off = 0;
  params[off++] = market;
  codeBytes.copy(params, off); off += 9;
  params.writeUInt16LE(category, off); off += 2;
  params.writeUInt16LE(1, off); off += 2;
  params.writeUInt32LE(start, off); off += 4;
  params.writeUInt16LE(count, off);

  return Buffer.concat([header, cmd, params]);
}

export function parseInstrumentBarsResponse(
  body: Buffer,
  category: number,
): ExtBar[] {
  let pos = 18; // skip preamble
  const retCount = body.readUInt16LE(pos); pos += 2;
  const bars: ExtBar[] = [];

  for (let i = 0; i < retCount; i++) {
    const [year, month, day, hour, minute, newPos] = getDatetime(body, pos, category);
    pos = newPos;

    const open = body.readFloatLE(pos);
    const high = body.readFloatLE(pos + 4);
    const low = body.readFloatLE(pos + 8);
    const close = body.readFloatLE(pos + 12);
    const position = body.readUInt32LE(pos + 16);
    const trade = body.readUInt32LE(pos + 20);
    pos += 28;

    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const hh = String(hour).padStart(2, "0");
    const mi = String(minute).padStart(2, "0");

    bars.push({
      date: `${year}-${mm}-${dd} ${hh}:${mi}`,
      open, close, high, low,
      vol: trade,
      amount: trade,
      year, month, day, hour, minute,
      position, trade,
    });
  }

  return bars;
}

export async function getInstrumentBars(
  api: TdxBaseApi,
  category: number,
  market: number,
  code: string,
  start: number,
  count: number,
): Promise<ExtBar[]> {
  const req = buildInstrumentBarsRequest(category, market, code, start, count);
  const body = await api.sendRequest(0, req);
  return parseInstrumentBarsResponse(body, category);
}
