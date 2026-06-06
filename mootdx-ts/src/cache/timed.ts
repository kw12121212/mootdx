export function lruCache(seconds?: number, maxsize?: number) {
  const cache = new Map<string, { value: unknown; expiry: number }>();
  let expiration = seconds ? Date.now() + seconds * 1000 : Infinity;

  return (_target: object, _propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: unknown[]) => unknown>) => {
    const original = descriptor.value!;
    descriptor.value = function (this: unknown, ...args: unknown[]): unknown {
      if (seconds && Date.now() > expiration) {
        cache.clear();
        expiration = Date.now() + seconds * 1000;
      }

      const key = JSON.stringify(args);
      const cached = cache.get(key);
      if (cached && Date.now() < cached.expiry) {
        return cached.value;
      }

      const result = original.apply(this, args);

      if (maxsize && cache.size >= maxsize) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) cache.delete(firstKey);
      }

      cache.set(key, {
        value: result,
        expiry: seconds ? Date.now() + seconds * 1000 : Infinity,
      });

      return result;
    };
    return descriptor;
  };
}
