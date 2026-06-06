import { test, expect } from "bun:test";
import { SETUP_CMD1, SETUP_CMD2, SETUP_CMD3 } from "./login";

test("SETUP_CMD1 has correct bytes", () => {
  expect(SETUP_CMD1.length).toBe(13);
  expect(SETUP_CMD1[0]).toBe(0x0c);
  expect(SETUP_CMD1[10]).toBe(0x0d);
  expect(SETUP_CMD1[12]).toBe(0x01);
});

test("SETUP_CMD2 has correct bytes", () => {
  expect(SETUP_CMD2.length).toBe(13);
  expect(SETUP_CMD2[0]).toBe(0x0c);
  expect(SETUP_CMD2[12]).toBe(0x02);
});

test("SETUP_CMD3 has correct bytes", () => {
  expect(SETUP_CMD3.length).toBe(42);
  expect(SETUP_CMD3[0]).toBe(0x0c);
  expect(SETUP_CMD3[6]).toBe(0x20);
  expect(SETUP_CMD3[41]).toBe(0x02);
});

test("SETUP_CMD1 and CMD2 differ only in byte 3 and last byte", () => {
  expect(SETUP_CMD1[3]).toBe(0x93);
  expect(SETUP_CMD2[3]).toBe(0x94);
  expect(SETUP_CMD1[12]).toBe(0x01);
  expect(SETUP_CMD2[12]).toBe(0x02);
});
