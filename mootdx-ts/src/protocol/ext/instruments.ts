import type { TdxBaseApi } from "../base";

export interface InstrumentInfo {
  market: number;
  code: string;
  name: string;
}

export function buildInstrumentCountRequest(): Buffer {
  return Buffer.from([
    0x01, 0x01, 0x08, 0x6a, 0x01, 0x01, 0x06, 0x00,
    0x06, 0x00, 0x49, 0x24, 0x00, 0x00, 0x75, 0xc7,
    0x33, 0x01,
  ]);
}

export function parseInstrumentCountResponse(body: Buffer): number {
  return body.readUInt16LE(0);
}

export async function getInstrumentCount(api: TdxBaseApi): Promise<number> {
  const body = await api.sendRequest(0, buildInstrumentCountRequest());
  return parseInstrumentCountResponse(body);
}

export function buildInstrumentListRequest(start: number, count: number): Buffer {
  const buf = Buffer.alloc(20);
  let offset = 0;
  buf[offset++] = 0x01; buf[offset++] = 0x01;
  buf[offset++] = 0x08; buf[offset++] = 0x6a;
  buf[offset++] = 0x01; buf[offset++] = 0x01;
  buf[offset++] = 0x0c; buf[offset++] = 0x00;
  buf[offset++] = 0x0c; buf[offset++] = 0x00;
  buf[offset++] = 0x4a; buf[offset++] = 0x24;
  buf.writeUInt16LE(start, offset); offset += 2;
  buf.writeUInt16LE(count, offset);
  return buf;
}

export function parseInstrumentListResponse(body: Buffer): InstrumentInfo[] {
  let pos = 0;
  const num = body.readUInt16LE(pos); pos += 2;
  const instruments: InstrumentInfo[] = [];

  for (let i = 0; i < num; i++) {
    // market(B) + code(9s) + name fields
    const market = body[pos]!;
    const code = body.subarray(pos + 1, pos + 10).toString("utf-8").replace(/\x00/g, "").trim();
    pos += 10;
    // Skip remaining fixed-size fields per record
    // The exact format varies; skip rest based on known record size
    pos += 22; // approximate skip
    instruments.push({ market, code, name: code });
  }

  return instruments;
}

export async function getInstrumentList(
  api: TdxBaseApi,
  start: number,
  count: number,
): Promise<InstrumentInfo[]> {
  const req = buildInstrumentListRequest(start, count);
  const body = await api.sendRequest(0, req);
  return parseInstrumentListResponse(body);
}
