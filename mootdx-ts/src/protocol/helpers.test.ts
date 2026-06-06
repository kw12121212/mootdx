import { test, expect } from "bun:test";
import { getPrice, getVolume, getDatetime, getTime } from "./helpers";

// --- getPrice tests ---

test("getPrice decodes a single-byte positive value", () => {
  // bit7=0 (no continuation), bit6=0 (positive), bits0-5=42
  const buf = Buffer.from([0x2a]);
  const [val, pos] = getPrice(buf, 0);
  expect(val).toBe(42);
  expect(pos).toBe(1);
});

test("getPrice decodes a single-byte zero", () => {
  const buf = Buffer.from([0x00]);
  const [val, pos] = getPrice(buf, 0);
  expect(val).toBe(0);
  expect(pos).toBe(1);
});

test("getPrice decodes a single-byte negative value", () => {
  // bit7=0, bit6=1 (negative), bits0-5=5
  const buf = Buffer.from([0x45]);
  const [val, pos] = getPrice(buf, 0);
  expect(val).toBe(-5);
  expect(pos).toBe(1);
});

test("getPrice decodes a multi-byte positive value", () => {
  // First byte: bit7=1 (continuation), bit6=0 (positive), bits0-5=0x3f (63)
  // Second byte: bit7=0 (no continuation), bits0-6=1
  // value = 63 + (1 << 6) = 63 + 64 = 127
  const buf = Buffer.from([0xbf, 0x01]);
  const [val, pos] = getPrice(buf, 0);
  expect(val).toBe(127);
  expect(pos).toBe(2);
});

test("getPrice decodes a multi-byte negative value", () => {
  // First byte: bit7=1, bit6=1 (negative), bits0-5=0x3f
  // Second byte: bit7=0, bits0-6=1
  // value = -(63 + 64) = -127
  const buf = Buffer.from([0xff, 0x01]);
  const [val, pos] = getPrice(buf, 0);
  expect(val).toBe(-127);
  expect(pos).toBe(2);
});

test("getPrice works at non-zero offset", () => {
  const buf = Buffer.from([0x00, 0x00, 0x2a]);
  const [val, pos] = getPrice(buf, 2);
  expect(val).toBe(42);
  expect(pos).toBe(3);
});

test("getPrice decodes three-byte value", () => {
  // First byte: 0xbf (continuation, +, data=63)
  // Second byte: 0xff (continuation, data=127)
  // Third byte: 0x01 (no continuation, data=1)
  // value = 63 + (127 << 6) + (1 << 13) = 63 + 8128 + 8192 = 16383
  const buf = Buffer.from([0xbf, 0xff, 0x01]);
  const [val, pos] = getPrice(buf, 0);
  expect(val).toBe(16383);
  expect(pos).toBe(3);
});

// --- getVolume tests ---

test("getVolume returns 2^-127 for zero input (matches Python behavior)", () => {
  // logpoint=0, dwEcx=-127 -> dbl_xmm6 = 1/2^127, rest=0
  expect(getVolume(0)).toBeCloseTo(2.0 ** -127, 20);
});

test("getVolume decodes a known packed volume", () => {
  // hheax=0x80=128, hleax=0x80=128, lheax=0, lleax=0
  // logpoint=128, dbl_xmm6 = 2^129, dbl_xmm4 = 2^122*128 = 2^129, rest=0
  // total = 2^129 + 2^129 = 2^130
  const ivol = 0x80800000;
  const result = getVolume(ivol);
  expect(result).toBeCloseTo(2.0 ** 130, -10);
});

test("getVolume decodes small volume", () => {
  // hheax=1, hleax=0, lheax=0, lleax=0 -> logpoint=1
  // dwEcx=-125, dbl_xmm6 = 1/2^125, rest=0
  const ivol = 0x01000000;
  const result = getVolume(ivol);
  expect(result).toBeCloseTo(1 / 2 ** 125, 20);
});

// --- getDatetime tests ---

test("getDatetime decodes packed format for category 0 (zipday+minutes)", () => {
  // zipday = (year-2004)<<11 | month*100 + day
  // year=2024 -> (2024-2004)=20 -> 20<<11 = 40960
  // month=6, day=15 -> 6*100+15=615
  // zipday = 40960 + 615 = 41575
  // tminutes = 14*60+30 = 870
  const buf = Buffer.alloc(8);
  buf.writeUInt16LE(41575, 0);
  buf.writeUInt16LE(870, 2);

  const [year, month, day, hour, minute, pos] = getDatetime(buf, 0, 0);
  expect(year).toBe(2024);
  expect(month).toBe(6);
  expect(day).toBe(15);
  expect(hour).toBe(14);
  expect(minute).toBe(30);
  expect(pos).toBe(4);
});

test("getDatetime decodes YYYYMMDD format for category 4", () => {
  // zipday = 20240615
  const buf = Buffer.alloc(8);
  buf.writeUInt32LE(20240615, 0);

  const [year, month, day, hour, minute, pos] = getDatetime(buf, 0, 4);
  expect(year).toBe(2024);
  expect(month).toBe(6);
  expect(day).toBe(15);
  expect(hour).toBe(15);
  expect(minute).toBe(0);
  expect(pos).toBe(4);
});

test("getDatetime decodes packed format for category 7", () => {
  const buf = Buffer.alloc(8);
  // year=2025 -> (2025-2004)=21 -> 21<<11=43008
  // month=1, day=2 -> 1*100+2=102
  // zipday = 43008 + 102 = 43110
  buf.writeUInt16LE(43110, 0);
  buf.writeUInt16LE(570, 2); // 9:30

  const [year, month, day, hour, minute] = getDatetime(buf, 0, 7);
  expect(year).toBe(2025);
  expect(month).toBe(1);
  expect(day).toBe(2);
  expect(hour).toBe(9);
  expect(minute).toBe(30);
});

test("getDatetime decodes packed format for category 8", () => {
  const buf = Buffer.alloc(8);
  buf.writeUInt16LE(41575, 0);
  buf.writeUInt16LE(0, 2);

  const [year, month, day, hour, minute] = getDatetime(buf, 0, 8);
  expect(year).toBe(2024);
  expect(month).toBe(6);
  expect(day).toBe(15);
  expect(hour).toBe(0);
  expect(minute).toBe(0);
});

// --- getTime tests ---

test("getTime decodes hour and minute", () => {
  // 14*60+30 = 870
  const buf = Buffer.alloc(4);
  buf.writeUInt16LE(870, 0);

  const [hour, minute, pos] = getTime(buf, 0);
  expect(hour).toBe(14);
  expect(minute).toBe(30);
  expect(pos).toBe(2);
});

test("getTime decodes midnight", () => {
  const buf = Buffer.alloc(4);
  buf.writeUInt16LE(0, 0);

  const [hour, minute, pos] = getTime(buf, 0);
  expect(hour).toBe(0);
  expect(minute).toBe(0);
  expect(pos).toBe(2);
});

test("getTime works at non-zero offset", () => {
  const buf = Buffer.alloc(6);
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(495, 2); // 8:15

  const [hour, minute, pos] = getTime(buf, 2);
  expect(hour).toBe(8);
  expect(minute).toBe(15);
  expect(pos).toBe(4);
});
