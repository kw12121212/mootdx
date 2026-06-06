import { test, expect } from "bun:test";
import { buildKlineRequest, parseSecurityBarsResponse } from "./security_bars";
import { parseIndexBarsResponse } from "./index_bars";

test("buildKlineRequest creates 38-byte packet", () => {
  const req = buildKlineRequest(9, 0, "000001", 0, 10);
  expect(req.length).toBe(38);
  // magic
  expect(req.readUInt16LE(0)).toBe(0x010c);
  // cmd_id
  expect(req.readUInt32LE(2)).toBe(0x01016408);
  // lengths
  expect(req.readUInt16LE(6)).toBe(0x1c);
  expect(req.readUInt16LE(8)).toBe(0x1c);
  // sub-cmd
  expect(req.readUInt16LE(10)).toBe(0x052d);
  // market
  expect(req.readUInt16LE(12)).toBe(0);
  // code at offset 14 (6 bytes)
  expect(req.subarray(14, 20).toString("ascii").trim()).toBe("000001");
  // category
  expect(req.readUInt16LE(20)).toBe(9);
  // start
  expect(req.readUInt16LE(24)).toBe(0);
  // count
  expect(req.readUInt16LE(26)).toBe(10);
});

test("buildKlineRequest pads short codes", () => {
  const req = buildKlineRequest(4, 1, "1", 0, 800);
  // code padded with spaces
  const codeField = req.subarray(14, 20).toString("ascii");
  expect(codeField).toBe("1\x20\x20\x20\x20\x20");
});

test("parseSecurityBarsResponse handles empty response", () => {
  const body = Buffer.alloc(2);
  body.writeUInt16LE(0, 0);
  const bars = parseSecurityBarsResponse(body, 4);
  expect(bars).toEqual([]);
});

test("parseSecurityBarsResponse decodes a single bar with packed datetime", () => {
  // Build a minimal response with 1 bar
  // count=1, then: datetime(4) + 4x getPrice + 2x vol(U32)
  // Using category=4 (YYYYMMDD format for datetime)
  const body = Buffer.alloc(50);
  let offset = 0;

  // count
  body.writeUInt16LE(1, offset); offset += 2;

  // datetime: category=4 => zipday = YYYYMMDD = 20240615
  body.writeUInt32LE(20240615, offset); offset += 4;

  // priceOpenDiff: single-byte positive value 10 (0x0A, bit7=0 no cont, bit6=0 positive, bits0-5=10)
  body[offset] = 10; offset += 1;
  // priceCloseDiff: 0
  body[offset] = 0; offset += 1;
  // priceHighDiff: 5
  body[offset] = 5; offset += 1;
  // priceLowDiff: 3
  body[offset] = 3; offset += 1;

  // vol_raw: simple value, getVolume will decode
  body.writeUInt32LE(0, offset); offset += 4;
  // amount_raw
  body.writeUInt32LE(0, offset); offset += 4;

  const bars = parseSecurityBarsResponse(body.subarray(0, offset), 4);
  expect(bars.length).toBe(1);
  expect(bars[0]!.year).toBe(2024);
  expect(bars[0]!.month).toBe(6);
  expect(bars[0]!.day).toBe(15);
  // open = calPrice1000(10, 0) = 0.01
  expect(bars[0]!.open).toBeCloseTo(0.01, 5);
});

test("parseIndexBarsResponse handles empty response", () => {
  const body = Buffer.alloc(2);
  body.writeUInt16LE(0, 0);
  const bars = parseIndexBarsResponse(body, 4);
  expect(bars).toEqual([]);
});

test("parseIndexBarsResponse includes upCount and downCount", () => {
  const body = Buffer.alloc(50);
  let offset = 0;

  body.writeUInt16LE(1, offset); offset += 2;

  // datetime (category=4)
  body.writeUInt32LE(20240615, offset); offset += 4;

  // 4x price (single byte positive values)
  body[offset] = 10;  offset += 1;
  body[offset] = 0;   offset += 1;
  body[offset] = 5;   offset += 1;
  body[offset] = 3;   offset += 1;

  // vol + amount
  body.writeUInt32LE(0, offset); offset += 4;
  body.writeUInt32LE(0, offset); offset += 4;

  // upCount + downCount
  body.writeUInt16LE(42, offset); offset += 2;
  body.writeUInt16LE(58, offset); offset += 2;

  const bars = parseIndexBarsResponse(body.subarray(0, offset), 4);
  expect(bars.length).toBe(1);
  expect(bars[0]!.upCount).toBe(42);
  expect(bars[0]!.downCount).toBe(58);
});
