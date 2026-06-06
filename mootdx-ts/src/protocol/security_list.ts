import iconv from "iconv-lite";
import type { SecurityInfo } from "../types";
import type { TdxBaseApi } from "./base";

export function buildListRequest(market: number, start: number): Buffer {
  const buf = Buffer.alloc(16);
  let offset = 0;

  buf.writeUInt16LE(0x010c, offset); offset += 2;
  buf.writeUInt32LE(0x800400, offset); offset += 4;
  buf.writeUInt16LE(4, offset); offset += 2;
  buf.writeUInt16LE(4, offset); offset += 2;
  buf.writeUInt16LE(0x0450, offset); offset += 2;
  buf.writeUInt16LE(market, offset); offset += 2;
  buf.writeUInt16LE(start, offset);

  return buf;
}

export function parseListResponse(body: Buffer, market: number): SecurityInfo[] {
  let pos = 0;
  const num = body.readUInt16LE(pos); pos += 2;

  const securities: SecurityInfo[] = [];

  for (let i = 0; i < num; i++) {
    const code = body.subarray(pos, pos + 6).toString("ascii").replace(/\x00/g, "").trim();
    pos += 6;
    // vol (U16) — not used in SecurityInfo
    pos += 2;
    // name: GBK-encoded, null-terminated, up to remainder of record
    // Each record is fixed: code(6) + vol(2) + name(variable, null-terminated)
    const nameStart = pos;
    while (pos < body.length && body[pos] !== 0) pos++;
    const nameBytes = body.subarray(nameStart, pos);
    const name = iconv.decode(nameBytes, "gbk").trim();
    pos += 1; // skip null terminator

    securities.push({ market, code, name });
  }

  return securities;
}

export async function getSecurityList(
  api: TdxBaseApi,
  market: number,
  start: number,
): Promise<SecurityInfo[]> {
  const req = buildListRequest(market, start);
  const body = await api.sendRequest(0x0450, req);
  return parseListResponse(body, market);
}
