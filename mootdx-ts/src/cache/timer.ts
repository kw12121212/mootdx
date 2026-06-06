export function timeit<T extends (...args: unknown[]) => unknown>(
  _target: object,
  _propertyKey: string,
  descriptor: TypedPropertyDescriptor<T>,
): TypedPropertyDescriptor<T> {
  const original = descriptor.value!;
  descriptor.value = function (this: unknown, ...args: unknown[]): unknown {
    const start = performance.now();
    const result = original.apply(this, args);
    const elapsed = performance.now() - start;
    const name = _propertyKey;
    if (elapsed > 1000) {
      console.log(`${name} took ${(elapsed / 1000).toFixed(2)}s`);
    } else {
      console.log(`${name} took ${elapsed.toFixed(2)}ms`);
    }
    return result;
  } as T;
  return descriptor;
}
