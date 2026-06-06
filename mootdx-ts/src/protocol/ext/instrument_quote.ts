import type { TdxBaseApi } from "../base";

export interface ExtQuote {
  market: number;
  code: string;
  preClose: number;
  open: number;
  high: number;
  low: number;
  price: number;
  kaicang: number;
  zongliang: number;
  xianliang: number;
  neipan: number;
  waipan: number;
  chicang: number;
  bid1: number; bid2: number; bid3: number; bid4: number; bid5: number;
  bidVol1: number; bidVol2: number; bidVol3: number; bidVol4: number; bidVol5: number;
  ask1: number; ask2: number; ask3: number; ask4: number; ask5: number;
  askVol1: number; askVol2: number; askVol3: number; askVol4: number; askVol5: number;
}

export function buildInstrumentQuoteRequest(market: number, code: string): Buffer {
  const header = Buffer.from([
    0x01, 0x01, 0x08, 0x02, 0x02, 0x01, 0x0c, 0x00,
    0x0c, 0x00, 0xfa, 0x23,
  ]);
  const codeBytes = Buffer.alloc(9, 0);
  Buffer.from(code).copy(codeBytes);
  const params = Buffer.alloc(10);
  params[0] = market;
  codeBytes.copy(params, 1);
  return Buffer.concat([header, params]);
}

export function parseInstrumentQuoteResponse(body: Buffer): ExtQuote[] {
  if (body.length < 20) return [];

  let pos = 0;
  const market = body[pos]!;
  const code = body.subarray(pos + 1, pos + 10).toString("utf-8").replace(/\x00/g, "");
  pos += 10;
  pos += 4; // skip 4

  const view = new DataView(body.buffer, body.byteOffset + pos);
  let vi = 0;
  const preClose = view.getFloat32(vi, true); vi += 4;
  const open = view.getFloat32(vi, true); vi += 4;
  const high = view.getFloat32(vi, true); vi += 4;
  const low = view.getFloat32(vi, true); vi += 4;
  const price = view.getFloat32(vi, true); vi += 4;
  const kaicang = view.getUint32(vi, true); vi += 4;
  vi += 4; // skip _
  const zongliang = view.getUint32(vi, true); vi += 4;
  const xianliang = view.getUint32(vi, true); vi += 4;
  vi += 4; // skip _
  const neipan = view.getUint32(vi, true); vi += 4;
  const waipan = view.getUint32(vi, true); vi += 4;
  vi += 4; // skip _
  const chicang = view.getUint32(vi, true); vi += 4;

  const bid1 = view.getFloat32(vi, true); vi += 4;
  const bid2 = view.getFloat32(vi, true); vi += 4;
  const bid3 = view.getFloat32(vi, true); vi += 4;
  const bid4 = view.getFloat32(vi, true); vi += 4;
  const bid5 = view.getFloat32(vi, true); vi += 4;

  const bidVol1 = view.getUint32(vi, true); vi += 4;
  const bidVol2 = view.getUint32(vi, true); vi += 4;
  const bidVol3 = view.getUint32(vi, true); vi += 4;
  const bidVol4 = view.getUint32(vi, true); vi += 4;
  const bidVol5 = view.getUint32(vi, true); vi += 4;

  const ask1 = view.getFloat32(vi, true); vi += 4;
  const ask2 = view.getFloat32(vi, true); vi += 4;
  const ask3 = view.getFloat32(vi, true); vi += 4;
  const ask4 = view.getFloat32(vi, true); vi += 4;
  const ask5 = view.getFloat32(vi, true); vi += 4;

  const askVol1 = view.getUint32(vi, true); vi += 4;
  const askVol2 = view.getUint32(vi, true); vi += 4;
  const askVol3 = view.getUint32(vi, true); vi += 4;
  const askVol4 = view.getUint32(vi, true); vi += 4;
  const askVol5 = view.getUint32(vi, true);

  return [{
    market, code, preClose, open, high, low, price,
    kaicang, zongliang, xianliang, neipan, waipan, chicang,
    bid1, bid2, bid3, bid4, bid5,
    bidVol1, bidVol2, bidVol3, bidVol4, bidVol5,
    ask1, ask2, ask3, ask4, ask5,
    askVol1, askVol2, askVol3, askVol4, askVol5,
  }];
}

export async function getInstrumentQuote(
  api: TdxBaseApi,
  market: number,
  code: string,
): Promise<ExtQuote[]> {
  const req = buildInstrumentQuoteRequest(market, code);
  const body = await api.sendRequest(0, req);
  return parseInstrumentQuoteResponse(body);
}
