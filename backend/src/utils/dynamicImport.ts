// TypeScript downlevels `await import(...)` into a `require()` call when
// compiling to CommonJS, which breaks loading pure-ESM packages (file-type,
// heic-convert, pdf-to-img). Wrapping it in `new Function` hides the call
// from that transform so a real dynamic `import()` runs at runtime.
export const dynamicImport: (specifier: string) => Promise<any> = new Function(
  'specifier',
  'return import(specifier)'
) as (specifier: string) => Promise<any>;

const cache = new Map<string, Promise<any>>();

/**
 * Same as dynamicImport, but resolves the module only once per process and
 * reuses that promise afterwards. Under Jest + --experimental-vm-modules, a
 * fresh `import()` call per request can resolve *after* that test file's VM
 * context has been torn down (if a later file's requests overlap it),
 * throwing "Test environment has been torn down". Caching means only the
 * very first call ever touches the dynamic import machinery — callers
 * should pre-warm it (e.g. in a beforeAll) so that call is safely awaited.
 */
export function cachedDynamicImport(specifier: string): Promise<any> {
  let promise = cache.get(specifier);
  if (!promise) {
    promise = dynamicImport(specifier);
    cache.set(specifier, promise);
  }
  return promise;
}
