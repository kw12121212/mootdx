import type { TdxBaseApi } from "./base";

export interface BlockMeta {
  size: number;
  hash: string;
}

export function buildBlockInfoMetaRequest(blockFile: string): Buffer {
  const fileBytes = Buffer.alloc(40, 0);
  Buffer.from(blockFile).copy(fileBytes);

  const buf = Buffer.alloc(48);
  let offset = 0;

  buf.writeUInt16LE(0x010c, offset); offset += 2;
  buf.writeUInt32LE(0x6918392a, offset); offset += 4;
  buf.writeUInt16LE(0x2a, offset); offset += 2;
  buf.writeUInt16LE(0x2a, offset); offset += 2;
  buf.writeUInt16LE(0x02c5, offset); offset += 2;
  fileBytes.copy(buf, offset);

  return buf;
}

export function parseBlockInfoMetaResponse(body: Buffer): BlockMeta {
  let pos = 0;
  const size = body.readUInt32LE(pos);
  pos += 4;
  // skip 1-byte separator
  pos += 1;
  const hashBuf = body.subarray(pos, pos + 32);
  const hash = hashBuf.toString("ascii").replace(/\0+$/, "");

  return { size, hash };
}

export async function getBlockInfoMeta(
  api: TdxBaseApi,
  blockFile: string,
): Promise<BlockMeta> {
  const req = buildBlockInfoMetaRequest(blockFile);
  const body = await api.sendRequest(0x02c5, req);
  return parseBlockInfoMetaResponse(body);
}

export function buildBlockInfoRequest(
  start: number,
  size: number,
  blockFile: string,
): Buffer {
  const fileBytes = Buffer.alloc(100, 0);
  Buffer.from(blockFile).copy(fileBytes);

  const buf = Buffer.alloc(112);
  let offset = 0;

  buf.writeUInt16LE(0x010c, offset); offset += 2;
  buf.writeUInt32LE(0x6a18376e, offset); offset += 4;
  buf.writeUInt16LE(0x6e, offset); offset += 2;
  buf.writeUInt16LE(0x6e, offset); offset += 2;
  buf.writeUInt16LE(0x06b9, offset); offset += 2;
  buf.writeUInt32LE(start, offset); offset += 4;
  buf.writeUInt32LE(size, offset); offset += 4;
  fileBytes.copy(buf, offset);

  return buf;
}

export function parseBlockInfoResponse(body: Buffer): Buffer {
  // skip 4-byte prefix
  return body.subarray(4);
}

export async function getBlockInfo(
  api: TdxBaseApi,
  start: number,
  size: number,
  blockFile: string,
): Promise<Buffer> {
  const req = buildBlockInfoRequest(start, size, blockFile);
  const body = await api.sendRequest(0x06b9, req);
  return parseBlockInfoResponse(body);
}
