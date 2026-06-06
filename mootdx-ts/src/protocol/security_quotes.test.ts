import { test, expect } from "bun:test";
import { buildQuotesRequest, parseQuotesResponse } from "./security_quotes";

test("buildQuotesRequest creates correct packet for single stock", () => {
  const req = buildQuotesRequest([1], ["600000"]);
  // header: 0x010c(2) + 0x800400(4) + len(2) + len(2) + cmd(2) = 12
  // + count(2) + market(1) + code(6) = 7
  // total = 14 + 7 = 21
  expect(req.length).toBe(21);
  expect(req.readUInt16LE(0)).toBe(0x010c);
  expect(req.readUInt16LE(10)).toBe(0x053e);
  // stock count
  expect(req.readUInt16LE(12)).toBe(1);
  // market
  expect(req[14]).toBe(1);
  // code
  expect(req.subarray(15, 21).toString("ascii")).toBe("600000");
});

test("buildQuotesRequest pads short codes with spaces", () => {
  const req = buildQuotesRequest([0], ["1"]);
  const codeField = req.subarray(15, 21).toString("ascii");
  expect(codeField).toBe("1\x20\x20\x20\x20\x20");
});

test("buildQuotesRequest handles multiple stocks", () => {
  const req = buildQuotesRequest([1, 0], ["600000", "000001"]);
  expect(req.length).toBe(21 + 7); // header(14) + 2 stocks * 7
  expect(req.readUInt16LE(12)).toBe(2);
  expect(req[14]).toBe(1);
  expect(req[21]).toBe(0);
});

test("parseQuotesResponse handles empty response", () => {
  const body = Buffer.alloc(2);
  body.writeUInt16LE(0, 0);
  const quotes = parseQuotesResponse(body);
  expect(quotes).toEqual([]);
});

test("parseQuotesResponse decodes single quote with 5-level bid/ask", () => {
  // Build a response with 1 stock quote
  // Format: count(2) + per-stock: market(1) + code(6) + active(2) +
  //   lastCloseDiff(getPrice) + openDiff(getPrice) + highDiff(getPrice) + lowDiff(getPrice) +
  //   servertime(4) + curVol(getPrice) + vol(4) + curVol2(4) + amount(4) + sVol(4) + bVol(4) +
  //   5x (bidPrice(getPrice) + bidVol(4)) + 5x (askPrice(getPrice) + askVol(4))
  const body = Buffer.alloc(256);
  let offset = 0;

  body.writeUInt16LE(1, offset); offset += 2;

  // market
  body[offset] = 1; offset += 1;
  // code
  Buffer.from("600000").copy(body, offset); offset += 6;
  // active
  body.writeUInt16LE(1, offset); offset += 2;

  // lastCloseDiff = 10000 (price=10.000)
  // getPrice multi-byte: 10000 = 0x2710
  // byte0: bits0-5=16, bit7=1(cont), bit6=0(pos) => 0x90
  // byte1: (10000>>6)&0x7F = 28, bit7=1(cont since 10000>>6=156>0x7F) => 0x9C
  // byte2: (10000>>13)&0x7F = 1, bit7=0 => 0x01
  // Check: 16 + (28<<6) + (1<<13) = 16 + 1792 + 8192 = 10000 ✓
  body[offset] = 0x90; offset += 1;
  body[offset] = 0x9C; offset += 1;
  body[offset] = 0x01; offset += 1;

  // openDiff = 0 => lastCloseDiff + 0 = 10000, open = 10000/1000 = 10.0
  body[offset] = 0x00; offset += 1;

  // highDiff = 20 => single byte: 0x14 (bit7=0, bit6=0, bits0-5=20)
  // high = (10000+20)/1000 = 10.02
  body[offset] = 0x14; offset += 1;

  // lowDiff = 10 => 0x0A
  // low = (10000+10)/1000 = 10.01
  body[offset] = 0x0A; offset += 1;

  // servertime
  body.writeUInt32LE(1718534400, offset); offset += 4;

  // curVol diff (skipped) = 0
  body[offset] = 0x00; offset += 1;

  // vol
  body.writeUInt32LE(1000, offset); offset += 4;
  // curVol2
  body.writeUInt32LE(500, offset); offset += 4;
  // amount
  body.writeUInt32LE(2000, offset); offset += 4;
  // sVol
  body.writeUInt32LE(300, offset); offset += 4;
  // bVol
  body.writeUInt32LE(700, offset); offset += 4;

  // 5 bid levels: each is getPrice + vol(4)
  // bid1: price diff=5 => 0x05, vol=100
  body[offset] = 0x05; offset += 1;
  body.writeUInt32LE(100, offset); offset += 4;
  // bid2
  body[offset] = 0x04; offset += 1;
  body.writeUInt32LE(200, offset); offset += 4;
  // bid3
  body[offset] = 0x03; offset += 1;
  body.writeUInt32LE(300, offset); offset += 4;
  // bid4
  body[offset] = 0x02; offset += 1;
  body.writeUInt32LE(400, offset); offset += 4;
  // bid5
  body[offset] = 0x01; offset += 1;
  body.writeUInt32LE(500, offset); offset += 4;

  // 5 ask levels
  // ask1: price diff=6 => 0x06, vol=150
  body[offset] = 0x06; offset += 1;
  body.writeUInt32LE(150, offset); offset += 4;
  // ask2
  body[offset] = 0x07; offset += 1;
  body.writeUInt32LE(250, offset); offset += 4;
  // ask3
  body[offset] = 0x08; offset += 1;
  body.writeUInt32LE(350, offset); offset += 4;
  // ask4
  body[offset] = 0x09; offset += 1;
  body.writeUInt32LE(450, offset); offset += 4;
  // ask5
  body[offset] = 0x0A; offset += 1;
  body.writeUInt32LE(550, offset); offset += 4;

  const quotes = parseQuotesResponse(body.subarray(0, offset));
  expect(quotes.length).toBe(1);
  const q = quotes[0]!;

  expect(q.market).toBe(1);
  expect(q.code).toBe("600000");
  expect(q.active).toBe(1);

  // lastClose = 10000/1000 = 10.0
  expect(q.lastClose).toBeCloseTo(10.0, 2);
  // open = (10000+0)/1000 = 10.0
  expect(q.open).toBeCloseTo(10.0, 2);
  // high = (10000+20)/1000 = 10.02
  expect(q.high).toBeCloseTo(10.02, 2);
  // low = (10000+10)/1000 = 10.01
  expect(q.low).toBeCloseTo(10.01, 2);
  // price = lastClose = 10.0
  expect(q.price).toBeCloseTo(10.0, 2);

  expect(q.servertime).toBe(1718534400);
  expect(q.vol).toBe(1000);
  expect(q.amount).toBe(2000);

  // bid1 price = (10000+5)/1000 = 10.005, vol=100
  expect(q.bid1.price).toBeCloseTo(10.005, 2);
  expect(q.bid1.volume).toBe(100);

  // ask1 price = (10000+6)/1000 = 10.006, vol=150
  expect(q.ask1.price).toBeCloseTo(10.006, 2);
  expect(q.ask1.volume).toBe(150);

  // bid5 price = (10000+1)/1000 = 10.001
  expect(q.bid5.price).toBeCloseTo(10.001, 2);
  // ask5 price = (10000+10)/1000 = 10.01
  expect(q.ask5.price).toBeCloseTo(10.01, 2);
});
