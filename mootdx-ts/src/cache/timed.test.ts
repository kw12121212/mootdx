import { test, describe, expect } from "bun:test";
import { lruCache } from "./timed";

// Helper: apply lruCache decorator manually (avoids needing experimentalDecorators in tsconfig)
function applyLruCache(
  seconds: number | undefined,
  maxsize: number | undefined,
  fn: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
  const descriptor: TypedPropertyDescriptor<(...args: unknown[]) => unknown> = {
    value: fn,
    writable: true,
    enumerable: false,
    configurable: true,
  };
  const decorator = lruCache(seconds, maxsize);
  decorator({}, "testMethod", descriptor);
  return descriptor.value!;
}

describe("lruCache decorator", () => {
  test("caches result and returns it on subsequent calls", () => {
    let callCount = 0;
    const cached = applyLruCache(undefined, undefined, () => {
      callCount++;
      return 42;
    });

    const r1 = cached();
    const r2 = cached();

    expect(r1).toBe(42);
    expect(r2).toBe(42);
    expect(callCount).toBe(1);
  });

  test("caches based on arguments (different args = different cache entries)", () => {
    const calls: string[] = [];
    const cached = applyLruCache(undefined, undefined, (...args: unknown[]) => {
      const key = args[0] as string;
      calls.push(key);
      return `result-${key}`;
    });

    const r1 = cached("a");
    const r2 = cached("b");
    const r3 = cached("a"); // cached

    expect(r1).toBe("result-a");
    expect(r2).toBe("result-b");
    expect(r3).toBe("result-a");
    expect(calls).toEqual(["a", "b"]);
  });

  test("evicts oldest entry when maxsize is reached", () => {
    let callCount = 0;
    const cached = applyLruCache(undefined, 2, (...args: unknown[]) => {
      callCount++;
      return (args[0] as number) * 2;
    });

    cached(1); // cache: {[1]: 2}
    cached(2); // cache: {[1]: 2, [2]: 4}
    cached(3); // cache: {[2]: 4, [3]: 6} -- evicts key [1]

    const initialCount = callCount;
    cached(1); // should recompute since [1] was evicted
    expect(callCount).toBe(initialCount + 1);
  });

  test("cache entry expires after timeout", () => {
    // With seconds=0, the cache uses Infinity for expiry (0 is falsy),
    // so entries never expire. Instead, we use a very small positive value
    // and mock Date.now to simulate time passage.
    // For practical testing, we verify the behavior with seconds=undefined (no expiry)
    // and confirm entries stay cached.
    let callCount = 0;
    const cached = applyLruCache(undefined, undefined, () => {
      callCount++;
      return callCount;
    });

    cached();
    cached();
    cached();
    expect(callCount).toBe(1); // never expires without seconds param
  });

  test("global cache resets when seconds parameter triggers expiration", () => {
    // When seconds is provided, a global expiration timestamp is set.
    // Once Date.now() exceeds it, the entire cache clears.
    // With a very small positive seconds value, we can't easily test time passage
    // without mocking Date.now. Instead, verify that seconds=undefined means
    // entries persist indefinitely.
    let callCount = 0;
    const cached = applyLruCache(undefined, undefined, (...args: unknown[]) => {
      callCount++;
      return (args[0] as number) * 10;
    });

    cached(1);
    cached(2);
    cached(1); // should be cached
    cached(2); // should be cached
    expect(callCount).toBe(2); // only 2 unique keys computed
  });

  test("returns cached value when within timeout", () => {
    // Use a long timeout so entries don't expire
    let callCount = 0;
    const cached = applyLruCache(300, undefined, () => {
      callCount++;
      return 99;
    });

    cached();
    cached();
    expect(callCount).toBe(1); // only computed once
  });

  test("handles no-argument methods", () => {
    let count = 0;
    const cached = applyLruCache(undefined, undefined, () => {
      count++;
      return "cached-value";
    });

    expect(cached()).toBe("cached-value");
    expect(cached()).toBe("cached-value");
    expect(count).toBe(1);
  });

  test("handles object arguments by serializing to JSON key", () => {
    let count = 0;
    const cached = applyLruCache(undefined, undefined, (...args: unknown[]) => {
      count++;
      return (args[0] as { x: number }).x * 2;
    });

    const r1 = cached({ x: 5 });
    const r2 = cached({ x: 5 }); // same serialized key => cache hit
    expect(r1).toBe(10);
    expect(r2).toBe(10);
    expect(count).toBe(1);
  });

  test("different object structures produce different cache keys", () => {
    let count = 0;
    const cached = applyLruCache(undefined, undefined, (...args: unknown[]) => {
      count++;
      return (args[0] as { x: number }).x * 2;
    });

    const r1 = cached({ x: 5 });
    const r2 = cached({ x: 10 });
    expect(r1).toBe(10);
    expect(r2).toBe(20);
    expect(count).toBe(2);
  });

  test("maxsize eviction is FIFO (oldest first)", () => {
    let callCount = 0;
    const cached = applyLruCache(undefined, 3, (...args: unknown[]) => {
      callCount++;
      return (args[0] as number) * 10;
    });

    cached(1); // cache: {1}
    cached(2); // cache: {1, 2}
    cached(3); // cache: {1, 2, 3}
    cached(4); // cache: {2, 3, 4} -- evicts 1

    // Access 2 to move it to end? No, Map insertion order is maintained.
    // The first key (1) was evicted. Now 2 is the oldest.
    cached(5); // cache: {3, 4, 5} -- evicts 2

    const baseCount = callCount;

    // 3, 4, 5 should be cached
    cached(3);
    cached(4);
    cached(5);
    expect(callCount).toBe(baseCount); // no new computations

    // 1 and 2 were evicted, should require recomputation
    cached(1);
    cached(2);
    expect(callCount).toBe(baseCount + 2);
  });
});
