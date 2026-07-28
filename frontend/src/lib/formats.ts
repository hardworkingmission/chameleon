export const TARGET_FORMATS = [
  { value: 'jpg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
  { value: 'gif', label: 'GIF' },
  { value: 'bmp', label: 'BMP' },
  { value: 'tiff', label: 'TIFF' },
  { value: 'avif', label: 'AVIF' },
  { value: 'pdf', label: 'PDF' },
];

export const LOSSY_FORMATS = new Set(['jpg', 'webp', 'avif']);

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);
}
