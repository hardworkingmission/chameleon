// TypeScript downlevels `await import(...)` into a `require()` call when
// compiling to CommonJS, which breaks loading pure-ESM packages (file-type,
// heic-convert, pdf-to-img). Wrapping it in `new Function` hides the call
// from that transform so a real dynamic `import()` runs at runtime.
export const dynamicImport: (specifier: string) => Promise<any> = new Function(
  'specifier',
  'return import(specifier)'
) as (specifier: string) => Promise<any>;
