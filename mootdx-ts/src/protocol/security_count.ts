import type { TdxBaseApi } from "./base";

export function buildCountRequest(market: number): Buffer {
  const buf = Buffer.alloc(14);
  let offset = 0;

  buf.writeUInt16LE(0x010c, offset); offset += 2;
  buf.writeUInt32LE(0x800400, offset); offset += 4;
  buf.writeUInt16LE(2, offset); offset += 2;
  buf.writeUInt16LE(2, offset); offset += 2;
  buf.writeUInt16LE(0x044e, offset); offset += 2;
  buf.writeUInt16LE(market, offset);

  return buf;
}

export function parseCountResponse(body: Buffer): number {
  return body.readUInt16LE(0);
}

export async function getSecurityCount(
  api: TdxBaseApi,
  market: number,
): Promise<number> {
  const req = buildCountRequest(market);
  const body = await api.sendRequest(0x044e, req);
  return parseCountResponse(body);
}
