import type { TdxBaseApi } from "./base";

export interface ReportFileChunk {
  chunksize: number;
  chunkdata: Buffer;
}

export function buildReportFileRequest(
  offset: number,
  size: number,
  filename: string,
): Buffer {
  const fileBytes = Buffer.alloc(100, 0);
  Buffer.from(filename).copy(fileBytes);

  const innerLen = 2 + 4 + 4 + 100;
  const buf = Buffer.alloc(4 + innerLen);
  let offset2 = 0;

  buf.writeUInt16LE(innerLen, offset2); offset2 += 2;
  buf.writeUInt16LE(innerLen, offset2); offset2 += 2;

  buf.writeUInt16LE(0x06b9, offset2); offset2 += 2;
  buf.writeUInt32LE(offset, offset2); offset2 += 4;
  buf.writeUInt32LE(size, offset2); offset2 += 4;
  fileBytes.copy(buf, offset2);

  return buf;
}

export function parseReportFileResponse(body: Buffer): ReportFileChunk {
  const chunksize = body.readUInt32LE(0);
  if (chunksize === 0) {
    return { chunksize: 0, chunkdata: Buffer.alloc(0) };
  }
  const chunkdata = body.subarray(4, 4 + chunksize);
  return { chunksize, chunkdata };
}

export async function getReportFileBySize(
  api: TdxBaseApi,
  offset: number,
  size: number,
  filename: string,
): Promise<ReportFileChunk> {
  const req = buildReportFileRequest(offset, size, filename);
  const body = await api.sendRequest(0x06b9, req);
  return parseReportFileResponse(body);
}
