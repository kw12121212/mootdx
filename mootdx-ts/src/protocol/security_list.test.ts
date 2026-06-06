import { test, expect } from "bun:test";
import { buildListRequest, parseListResponse } from "./security_list";

test("buildListRequest creates 16-byte packet", () => {
  const req = buildListRequest(1, 0);
  expect(req.length).toBe(16);
  expect(req.readUInt16LE(0)).toBe(0x010c);
  expect(req.readUInt32LE(2)).toBe(0x800400);
  expect(req.readUInt16LE(6)).toBe(4);
  expect(req.readUInt16LE(8)).toBe(4);
  expect(req.readUInt16LE(10)).toBe(0x0450);
  expect(req.readUInt16LE(12)).toBe(1);
  expect(req.readUInt16LE(14)).toBe(0);
});

test("buildListRequest sets start offset", () => {
  const req = buildListRequest(0, 1000);
  expect(req.readUInt16LE(12)).toBe(0);
  expect(req.readUInt16LE(14)).toBe(1000);
});

test("parseListResponse handles empty response", () => {
  const body = Buffer.alloc(2);
  body.writeUInt16LE(0, 0);
  expect(parseListResponse(body, 1)).toEqual([]);
});

test("parseListResponse decodes security records with ASCII names", () => {
  // Build a response with 1 security
  // Format: count(2) + per-record: code(6) + vol(2) + name(null-terminated GBK)
  const body = Buffer.alloc(64);
  let offset = 0;

  body.writeUInt16LE(1, offset); offset += 2;

  // code
  Buffer.from("600000").copy(body, offset); offset += 6;
  // vol
  body.writeUInt16LE(100, offset); offset += 2;
  // name: "浦发银行" encoded as GBK
  // GBK: 浦=C6D6, 发=B7A2, 银=D2F8, 行=D0D0
  const nameBytes = Buffer.from([0xC6, 0xD6, 0xB7, 0xA2, 0xD2, 0xF8, 0xD0, 0xD0, 0x00]);
  nameBytes.copy(body, offset); offset += nameBytes.length;

  const result = parseListResponse(body.subarray(0, offset), 1);
  expect(result.length).toBe(1);
  expect(result[0]!.code).toBe("600000");
  expect(result[0]!.market).toBe(1);
  expect(result[0]!.name).toBe("浦发银行");
});

test("parseListResponse decodes multiple securities", () => {
  const body = Buffer.alloc(128);
  let offset = 0;

  body.writeUInt16LE(2, offset); offset += 2;

  // Security 1
  Buffer.from("600000").copy(body, offset); offset += 6;
  body.writeUInt16LE(100, offset); offset += 2;
  // 浦发银行 GBK
  const name1 = Buffer.from([0xC6, 0xD6, 0xB7, 0xA2, 0xD2, 0xF8, 0xD0, 0xD0, 0x00]);
  name1.copy(body, offset); offset += name1.length;

  // Security 2
  Buffer.from("000001").copy(body, offset); offset += 6;
  body.writeUInt16LE(200, offset); offset += 2;
  // 平安银行: 平=C6BD, 安=B0B2, 银=D2F8, 行=D0D0
  const name2 = Buffer.from([0xC6, 0xBD, 0xB0, 0xB2, 0xD2, 0xF8, 0xD0, 0xD0, 0x00]);
  name2.copy(body, offset); offset += name2.length;

  const result = parseListResponse(body.subarray(0, offset), 0);
  expect(result.length).toBe(2);
  expect(result[0]!.code).toBe("600000");
  expect(result[0]!.market).toBe(0);
  expect(result[1]!.code).toBe("000001");
  expect(result[1]!.name).toBe("平安银行");
});
