import { test, expect } from "bun:test";
import { buildCountRequest, parseCountResponse } from "./security_count";

test("buildCountRequest creates 14-byte packet for SH market", () => {
  const req = buildCountRequest(1);
  expect(req.length).toBe(14);
  expect(req.readUInt16LE(0)).toBe(0x010c);
  expect(req.readUInt32LE(2)).toBe(0x800400);
  expect(req.readUInt16LE(6)).toBe(2);
  expect(req.readUInt16LE(8)).toBe(2);
  expect(req.readUInt16LE(10)).toBe(0x044e);
  expect(req.readUInt16LE(12)).toBe(1);
});

test("buildCountRequest creates correct packet for SZ market", () => {
  const req = buildCountRequest(0);
  expect(req.readUInt16LE(12)).toBe(0);
});

test("parseCountResponse returns U16 count", () => {
  const body = Buffer.alloc(2);
  body.writeUInt16LE(4280, 0);
  expect(parseCountResponse(body)).toBe(4280);
});

test("parseCountResponse handles zero count", () => {
  const body = Buffer.alloc(2);
  body.writeUInt16LE(0, 0);
  expect(parseCountResponse(body)).toBe(0);
});
