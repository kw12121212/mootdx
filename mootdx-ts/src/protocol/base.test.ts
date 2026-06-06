import { test, expect } from "bun:test";
import { TdxSocket } from "./socket";
import { TdxBaseApi, type ResponseHeader } from "./base";
import zlib from "node:zlib";

// --- TdxSocket unit tests (without real network) ---

test("TdxSocket initial state", () => {
  const sock = new TdxSocket();
  expect(sock.connected).toBe(false);
  expect(sock.host).toBe("");
  expect(sock.port).toBe(0);
});

test("TdxSocket disconnect on unconnected socket does not throw", () => {
  const sock = new TdxSocket();
  expect(() => sock.disconnect()).not.toThrow();
});

test("TdxSocket send throws when not connected", () => {
  const sock = new TdxSocket();
  expect(() => sock.send(Buffer.from([1, 2, 3]))).toThrow("socket not connected");
});

// --- TdxBaseApi unit tests ---

test("TdxBaseApi initial state", () => {
  const socket = new TdxSocket();
  const api = new TdxBaseApi(socket);
  expect(api.connected).toBe(false);
});

test("TdxBaseApi sendRequest throws when not connected", async () => {
  const socket = new TdxSocket();
  const api = new TdxBaseApi(socket);
  await expect(api.sendRequest(1, Buffer.alloc(0))).rejects.toThrow("socket not connected");
});

test("TdxBaseApi unpackResponseHeader parses correctly", () => {
  const socket = new TdxSocket();
  const api = new TdxBaseApi(socket);

  // Build a 16-byte header: <IIIHH
  // seqNo=1, cmd=0x052d, pkgType=0, zipSize=100, unzipSize=100
  const buf = Buffer.alloc(16);
  buf.writeUInt32LE(1, 0);    // seqNo
  buf.writeUInt32LE(0x052d, 4); // cmd
  buf.writeUInt32LE(0, 8);    // pkgType
  buf.writeUInt16LE(100, 12); // zipSize
  buf.writeUInt16LE(100, 14); // unzipSize

  // Access protected method via type assertion
  const header = (api as unknown as { unpackResponseHeader(b: Buffer): ResponseHeader }).unpackResponseHeader(buf);
  expect(header.seqNo).toBe(1);
  expect(header.cmd).toBe(0x052d);
  expect(header.pkgType).toBe(0);
  expect(header.zipSize).toBe(100);
  expect(header.unzipSize).toBe(100);
});

test("TdxBaseApi unpackResponseHeader detects compressed response", () => {
  const socket = new TdxSocket();
  const api = new TdxBaseApi(socket);

  const buf = Buffer.alloc(16);
  buf.writeUInt32LE(0, 0);
  buf.writeUInt32LE(0, 4);
  buf.writeUInt32LE(0, 8);
  buf.writeUInt16LE(50, 12);  // zipSize=50
  buf.writeUInt16LE(200, 14); // unzipSize=200

  const header = (api as unknown as { unpackResponseHeader(b: Buffer): ResponseHeader }).unpackResponseHeader(buf);
  expect(header.zipSize).toBe(50);
  expect(header.unzipSize).toBe(200);
  expect(header.zipSize < header.unzipSize).toBe(true);
});

test("TdxBaseApi packRequestHeader creates 16-byte buffer", () => {
  const socket = new TdxSocket();
  const api = new TdxBaseApi(socket);

  const header = (api as unknown as { packRequestHeader(cmd: number, len: number): Buffer }).packRequestHeader(0x052d, 100);
  expect(header.length).toBe(16);
  // magic bytes at offset 0
  expect(header.readUInt16LE(0)).toBe(0x010c);
  // dataLen at offset 12 and 14
  expect(header.readUInt16LE(12)).toBe(100);
  expect(header.readUInt16LE(14)).toBe(100);
});

// --- ResponseHeader roundtrip with real zlib ---

test("zlib inflate/deflate roundtrip works for protocol data", () => {
  const original = Buffer.alloc(1000);
  for (let i = 0; i < 1000; i++) original[i] = i % 256;
  const compressed = zlib.deflateSync(original);
  const decompressed = zlib.inflateSync(compressed);
  expect(decompressed.length).toBe(original.length);
  expect(compressed.length).toBeLessThan(original.length);
});
