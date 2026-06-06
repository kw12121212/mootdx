import type { FinanceInfo } from "../types";
import type { TdxBaseApi } from "./base";

export function buildFinanceRequest(market: number, code: string): Buffer {
  const codeBytes = Buffer.alloc(6, 0x20);
  Buffer.from(code).copy(codeBytes);

  const buf = Buffer.alloc(16);
  let offset = 0;

  buf.writeUInt16LE(0x010c, offset); offset += 2;
  buf.writeUInt32LE(0x76181f0b, offset); offset += 4;
  buf.writeUInt16LE(0x0b, offset); offset += 2;
  buf.writeUInt16LE(0x0b, offset); offset += 2;
  buf.writeUInt16LE(0x0010, offset); offset += 2;
  buf.writeUInt8(market, offset); offset += 1;
  codeBytes.copy(buf, offset);

  return buf;
}

export function parseFinanceResponse(body: Buffer): FinanceInfo {
  let pos = 0;

  // skip 2 bytes (num=1) + 7 bytes (market + code)
  pos += 9;

  const f = (p: number) => body.readFloatLE(p);
  const u16 = (p: number) => body.readUInt16LE(p);
  const u32 = (p: number) => body.readUInt32LE(p);

  const info: FinanceInfo = {};
  let p = pos;

  info.liutongguben = f(p) * 10000; p += 4;
  info.province = u16(p); p += 2;
  info.industry = u16(p); p += 2;
  info.updated_date = u32(p); p += 4;
  info.ipo_date = u32(p); p += 4;
  info.zongguben = f(p) * 10000; p += 4;
  info.guojiagu = f(p) * 10000; p += 4;
  info.faqirenfarengu = f(p) * 10000; p += 4;
  info.farengu = f(p) * 10000; p += 4;
  info.bgu = f(p) * 10000; p += 4;
  info.hgu = f(p) * 10000; p += 4;
  info.zhigonggu = f(p) * 10000; p += 4;
  info.zongzichan = f(p) * 10000; p += 4;
  info.liudongzichan = f(p) * 10000; p += 4;
  info.gudingzichan = f(p) * 10000; p += 4;
  info.wuxingzichan = f(p) * 10000; p += 4;
  info.gudongrenshu = f(p); p += 4;
  info.liudongfuzhai = f(p) * 10000; p += 4;
  info.changqifuzhai = f(p) * 10000; p += 4;
  info.zibengongjijin = f(p) * 10000; p += 4;
  info.jingzichan = f(p) * 10000; p += 4;
  info.zhuyingshouru = f(p) * 10000; p += 4;
  info.zhuyinglirun = f(p) * 10000; p += 4;
  info.yingshouzhangkuan = f(p) * 10000; p += 4;
  info.yingyelirun = f(p) * 10000; p += 4;
  info.touzishouyu = f(p) * 10000; p += 4;
  info.jingyingxianjinliu = f(p) * 10000; p += 4;
  info.zongxianjinliu = f(p) * 10000; p += 4;
  info.cunhuo = f(p) * 10000; p += 4;
  info.lirunzonghe = f(p) * 10000; p += 4;
  info.shuihoulirun = f(p) * 10000; p += 4;
  info.jinglirun = f(p) * 10000; p += 4;
  info.weifenlirun = f(p) * 10000; p += 4;
  info.baoliu1 = f(p); p += 4;
  info.baoliu2 = f(p);

  return info;
}

export async function getFinanceInfo(
  api: TdxBaseApi,
  market: number,
  code: string,
): Promise<FinanceInfo> {
  const req = buildFinanceRequest(market, code);
  const body = await api.sendRequest(0x0010, req);
  return parseFinanceResponse(body);
}
