export const IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'avif'] as const;
export const HEIC_FORMATS = ['heic', 'heif'] as const;
export const DOC_FORMATS = ['pdf'] as const;

export type ImageFormat = (typeof IMAGE_FORMATS)[number];
export type HeicFormat = (typeof HEIC_FORMATS)[number];
export type DocFormat = (typeof DOC_FORMATS)[number];
export type SupportedFormat = ImageFormat | HeicFormat | DocFormat;

export const ALL_SOURCE_FORMATS: readonly string[] = [...IMAGE_FORMATS, ...HEIC_FORMATS, ...DOC_FORMATS];

// Targets we can actually produce. PDF is only a valid target when the source is image(s).
export const ALL_TARGET_FORMATS: readonly string[] = [...IMAGE_FORMATS, 'pdf'];

export const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

export const EXT_TO_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_TO_EXT).map(([mime, ext]) => [ext, mime])
);

export function normalizeFormat(format: string): string {
  const f = format.trim().toLowerCase().replace(/^\./, '');
  return f === 'jpeg' ? 'jpg' : f;
}

export function isSupportedSourceFormat(format: string): boolean {
  return ALL_SOURCE_FORMATS.includes(normalizeFormat(format));
}

export function isSupportedTargetFormat(format: string): boolean {
  return ALL_TARGET_FORMATS.includes(normalizeFormat(format));
}

export function isImageFormat(format: string): format is ImageFormat {
  return (IMAGE_FORMATS as readonly string[]).includes(normalizeFormat(format));
}

export function isHeicFormat(format: string): format is HeicFormat {
  return (HEIC_FORMATS as readonly string[]).includes(normalizeFormat(format));
}

export function isPdfFormat(format: string): boolean {
  return normalizeFormat(format) === 'pdf';
}
