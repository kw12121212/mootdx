import type { XdxrRecord } from "../types";
import { getVolume } from "./helpers";
import type { TdxBaseApi } from "./base";

export function buildXdxrRequest(market: number, code: string): Buffer {
  const codeBytes = Buffer.alloc(6, 0x20);
  Buffer.from(code).copy(codeBytes);

  const buf = Buffer.alloc(16);
  let offset = 0;

  buf.writeUInt16LE(0x010c, offset); offset += 2;
  buf.writeUInt32LE(0x76181f0b, offset); offset += 4;
  buf.writeUInt16LE(0x0b, offset); offset += 2;
  buf.writeUInt16LE(0x0b, offset); offset += 2;
  buf.writeUInt16LE(0x000f, offset); offset += 2;
  buf.writeUInt8(market, offset); offset += 1;
  codeBytes.copy(buf, offset);

  return buf;
}

export function parseXdxrResponse(body: Buffer): XdxrRecord[] {
  if (body.length < 11) return [];

  let pos = 0;
  // skip 9 bytes
  pos += 9;
  const num = body.readUInt16LE(pos);
  pos += 2;

  const results: XdxrRecord[] = [];

  for (let i = 0; i < num; i++) {
    // 7 bytes: market(U8) + code(6s)
    pos += 7;
    // 1 byte skip
    pos += 1;

    // datetime: 4 bytes packed as two U16 (zipday + tminutes)
    const zipday = body.readUInt16LE(pos);
    body.readUInt16LE(pos + 2); // tminutes (unused)
    pos += 4;

    const year = (zipday >>> 11) + 2004;
    const month = ((zipday % 2048) / 100) | 0;
    const day = (zipday % 2048) % 100;

    const category = body.readUInt8(pos);
    pos += 1;

    const record: XdxrRecord = {
      year,
      month,
      day,
      category,
      fenhong: null,
      peigujia: null,
      songzhuangu: null,
      peigu: null,
      suogu: null,
      panqianliutong: null,
      panhouliutong: null,
      qianzongguben: null,
      houzongguben: null,
      fenshu: null,
      xingquanjia: null,
    };

    // 16 bytes of category-dependent fields
    if (category === 1) {
      // dividend: 4 floats
      record.fenhong = body.readFloatLE(pos);
      record.peigujia = body.readFloatLE(pos + 4);
      record.songzhuangu = body.readFloatLE(pos + 8);
      record.peigu = body.readFloatLE(pos + 12);
    } else if (category === 11 || category === 12) {
      // split/reverse split
      record.suogu = body.readFloatLE(pos + 8);
    } else if (category === 13 || category === 14) {
      // call/put warrant
      record.xingquanjia = body.readFloatLE(pos);
      record.fenshu = body.readFloatLE(pos + 8);
    } else {
      // other categories: 4 U32 decoded via getVolume
      record.panqianliutong = getVolume(body.readUInt32LE(pos));
      record.qianzongguben = getVolume(body.readUInt32LE(pos + 4));
      record.panhouliutong = getVolume(body.readUInt32LE(pos + 8));
      record.houzongguben = getVolume(body.readUInt32LE(pos + 12));
    }

    pos += 16;
    results.push(record);
  }

  return results;
}

export async function getXdXrInfo(
  api: TdxBaseApi,
  market: number,
  code: string,
): Promise<XdxrRecord[]> {
  const req = buildXdxrRequest(market, code);
  const body = await api.sendRequest(0x000f, req);
  return parseXdxrResponse(body);
}
