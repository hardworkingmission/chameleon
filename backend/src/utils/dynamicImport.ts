// Node16 compilation keeps native import() in the CommonJS output, allowing
// ESM dependencies to load without eval or a stale Jest VM import callback.
export const dynamicImport = (specifier: string): Promise<any> => import(specifier);
