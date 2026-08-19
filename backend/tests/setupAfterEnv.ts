import { cachedDynamicImport } from '../src/utils/dynamicImport';

// file-type, heic-convert, and pdf-to-img are ESM-only and loaded via a
// cached dynamic import (see src/utils/dynamicImport.ts). Pre-warm them here,
// properly awaited in a beforeAll, so the *first* (and only) real import()
// per test file happens safely instead of racing a later file's VM teardown
// under Jest + --experimental-vm-modules.
beforeAll(async () => {
  await Promise.all([
    cachedDynamicImport('file-type'),
    cachedDynamicImport('heic-convert'),
    cachedDynamicImport('pdf-to-img'),
  ]);
});
