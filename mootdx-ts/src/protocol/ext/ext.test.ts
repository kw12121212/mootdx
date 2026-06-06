import { test, expect } from "bun:test";
import { EX_SETUP_CMD } from "./setup";
import { buildInstrumentBarsRequest } from "./instrument_bars";
import { buildInstrumentQuoteRequest } from "./instrument_quote";
import { parseInstrumentQuoteResponse } from "./instrument_quote";
import { parseInstrumentCountResponse } from "./instruments";

test("EX_SETUP_CMD has correct length", () => {
  expect(EX_SETUP_CMD.length).toBe(92);
  expect(EX_SETUP_CMD[0]).toBe(0x01);
});

test("buildInstrumentBarsRequest creates valid packet", () => {
  const req = buildInstrumentBarsRequest(4, 7, "IFL0", 0, 100);
  expect(req.length).toBeGreaterThan(10);
  // header starts with 01 01 08 6a
  expect(req[0]).toBe(0x01);
  expect(req[1]).toBe(0x01);
  // ff 23 marker
  expect(req[10]).toBe(0xff);
  expect(req[11]).toBe(0x23);
});

test("buildInstrumentQuoteRequest creates valid packet", () => {
  const req = buildInstrumentQuoteRequest(47, "IF1709");
  expect(req.length).toBeGreaterThan(10);
  expect(req[0]).toBe(0x01);
  expect(req[10]).toBe(0xfa);
  expect(req[11]).toBe(0x23);
});

test("parseInstrumentQuoteResponse returns empty for short body", () => {
  const body = Buffer.alloc(10);
  const result = parseInstrumentQuoteResponse(body);
  expect(result).toEqual([]);
});

test("parseInstrumentCountResponse reads uint16", () => {
  const body = Buffer.alloc(4);
  body.writeUInt16LE(1234, 0);
  expect(parseInstrumentCountResponse(body)).toBe(1234);
});
