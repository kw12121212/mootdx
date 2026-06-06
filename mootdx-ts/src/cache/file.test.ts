import { test, describe, expect, afterAll, beforeEach } from "bun:test";
import { fileCache } from "./file";
import { FileNeedRefresh } from "../exceptions";
import { existsSync, unlinkSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const tmpDir = join(process.cwd(), "tmp_test_filecache");

afterAll(() => {
  try {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  } catch { /* ignore cleanup errors */ }
});

// Helper: apply fileCache decorator manually (avoids needing experimentalDecorators in tsconfig)
function applyFileCache<T>(
  filepath: string,
  refreshSeconds: number | undefined,
  fn: () => T,
): () => T {
  // Create a fake descriptor and apply the decorator
  const descriptor: TypedPropertyDescriptor<() => T> = {
    value: fn,
    writable: true,
    enumerable: false,
    configurable: true,
  };
  const decorator = fileCache<T>(filepath, refreshSeconds);
  decorator({}, "testMethod", descriptor);
  return descriptor.value!;
}

describe("fileCache decorator", () => {
  const cacheFile = join(tmpDir, "test_cache.json");

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
    try { unlinkSync(cacheFile); } catch { /* file may not exist */ }
  });

  test("creates cache file on first call and returns computed result", () => {
    let callCount = 0;
    const cached = applyFileCache(cacheFile, undefined, () => {
      callCount++;
      return { value: 42 };
    });

    const result = cached();
    expect(result).toEqual({ value: 42 });
    expect(callCount).toBe(1);
    expect(existsSync(cacheFile)).toBe(true);
  });

  test("reads from cache file on subsequent calls without recomputing", () => {
    // Pre-populate cache
    writeFileSync(cacheFile, JSON.stringify({ value: 77 }), "utf-8");

    let callCount = 0;
    const cached = applyFileCache(cacheFile, undefined, () => {
      callCount++;
      return { value: 99 };
    });

    const result = cached();
    expect(result).toEqual({ value: 77 });
    expect(callCount).toBe(0);
  });

  test("throws FileNeedRefresh when cache has expired", () => {
    // Pre-populate cache
    writeFileSync(cacheFile, JSON.stringify({ value: 2 }), "utf-8");

    const cached = applyFileCache(cacheFile, 0, () => ({ value: 1 }));

    expect(() => cached()).toThrow(FileNeedRefresh);
  });

  test("computes and caches when cache file does not exist", () => {
    try { unlinkSync(cacheFile); } catch { /* ok */ }

    const cached = applyFileCache(cacheFile, undefined, () => ({ computed: true }));

    const result = cached();
    expect(result).toEqual({ computed: true });
    expect(existsSync(cacheFile)).toBe(true);
  });

  test("handles array results", () => {
    const arrFile = join(tmpDir, "arr_cache.json");
    try { unlinkSync(arrFile); } catch { /* ok */ }

    const cached = applyFileCache(arrFile, undefined, () => [1, 2, 3]);

    const result = cached();
    expect(result).toEqual([1, 2, 3]);

    // Read again from cache
    const cached2 = applyFileCache(arrFile, undefined, () => [4, 5, 6]);
    const result2 = cached2();
    expect(result2).toEqual([1, 2, 3]); // still from cache
  });

  test("recomputes when cache file contains invalid JSON", () => {
    writeFileSync(cacheFile, "not valid json {{{", "utf-8");

    const cached = applyFileCache(cacheFile, undefined, () => ({ recovered: true }));
    const result = cached();
    expect(result).toEqual({ recovered: true });
  });
});

describe("FileNeedRefresh exception", () => {
  test("is an instance of Error", () => {
    const err = new FileNeedRefresh("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(FileNeedRefresh);
    expect(err.name).toBe("FileNeedRefresh");
    expect(err.message).toBe("test");
  });

  test("can be caught with try/catch", () => {
    try {
      throw new FileNeedRefresh("expired");
    } catch (e) {
      expect(e).toBeInstanceOf(FileNeedRefresh);
      if (e instanceof FileNeedRefresh) {
        expect(e.message).toContain("expired");
      }
    }
  });

  test("carries default message when not provided", () => {
    const err = new FileNeedRefresh();
    // Error constructor sets message to "" when undefined is passed
    expect(err.name).toBe("FileNeedRefresh");
  });
});
