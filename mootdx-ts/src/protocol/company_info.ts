import type { CompanyInfoCategory } from "../types";
import type { TdxBaseApi } from "./base";

function decodeGBK(buf: Buffer): string {
  const decoder = new TextDecoder("gb2312" as BufferEncoding);
  return decoder.decode(buf).replace(/\0+$/, "");
}

export function buildCompanyInfoCategoryRequest(
  market: number,
  code: string,
): Buffer {
  const codeBytes = Buffer.alloc(6, 0x20);
  Buffer.from(code).copy(codeBytes);

  const buf = Buffer.alloc(18);
  let offset = 0;

  buf.writeUInt16LE(0x010c, offset); offset += 2;
  buf.writeUInt32LE(0x9b100f0e, offset); offset += 4;
  buf.writeUInt16LE(0x0e, offset); offset += 2;
  buf.writeUInt16LE(0x0e, offset); offset += 2;
  buf.writeUInt16LE(0x02cf, offset); offset += 2;
  buf.writeUInt16LE(market, offset); offset += 2;
  codeBytes.copy(buf, offset); offset += 6;
  buf.writeUInt32LE(0, offset);

  return buf;
}

export function parseCompanyInfoCategoryResponse(
  body: Buffer,
): CompanyInfoCategory[] {
  let pos = 0;
  const num = body.readUInt16LE(pos);
  pos += 2;

  const results: CompanyInfoCategory[] = [];

  for (let i = 0; i < num; i++) {
    const nameBuf = body.subarray(pos, pos + 64);
    pos += 64;
    const filenameBuf = body.subarray(pos, pos + 80);
    pos += 80;
    const start = body.readUInt32LE(pos);
    pos += 4;
    const length = body.readUInt32LE(pos);
    pos += 4;

    results.push({
      name: decodeGBK(nameBuf),
      filename: decodeGBK(filenameBuf),
      start,
      length,
    });
  }

  return results;
}

export async function getCompanyInfoCategory(
  api: TdxBaseApi,
  market: number,
  code: string,
): Promise<CompanyInfoCategory[]> {
  const req = buildCompanyInfoCategoryRequest(market, code);
  const body = await api.sendRequest(0x02cf, req);
  return parseCompanyInfoCategoryResponse(body);
}

export function buildCompanyInfoContentRequest(
  market: number,
  code: string,
  filename: string,
  start: number,
  length: number,
): Buffer {
  const codeBytes = Buffer.alloc(6, 0x20);
  Buffer.from(code).copy(codeBytes);

  const filenameBytes = Buffer.alloc(80, 0);
  Buffer.from(filename).copy(filenameBytes);

  const buf = Buffer.alloc(104);
  let offset = 0;

  buf.writeUInt16LE(0x010c, offset); offset += 2;
  buf.writeUInt32LE(0x9c100768, offset); offset += 4;
  buf.writeUInt16LE(0x68, offset); offset += 2;
  buf.writeUInt16LE(0x68, offset); offset += 2;
  buf.writeUInt16LE(0x02d0, offset); offset += 2;
  buf.writeUInt16LE(market, offset); offset += 2;
  codeBytes.copy(buf, offset); offset += 6;
  buf.writeUInt16LE(0, offset); offset += 2;
  filenameBytes.copy(buf, offset); offset += 80;
  buf.writeUInt32LE(start, offset); offset += 4;
  buf.writeUInt32LE(length, offset); offset += 4;
  buf.writeUInt32LE(0, offset);

  return buf;
}

export function parseCompanyInfoContentResponse(
  body: Buffer,
  length: number,
): string {
  // skip 10 bytes, then 2-byte content length, then content
  const contentLen = body.readUInt16LE(10);
  const actualLen = Math.min(contentLen, length);
  const contentBuf = body.subarray(12, 12 + actualLen);
  return decodeGBK(contentBuf);
}

export async function getCompanyInfoContent(
  api: TdxBaseApi,
  market: number,
  code: string,
  filename: string,
  start: number,
  length: number,
): Promise<string> {
  const req = buildCompanyInfoContentRequest(market, code, filename, start, length);
  const body = await api.sendRequest(0x02d0, req);
  return parseCompanyInfoContentResponse(body, length);
}
