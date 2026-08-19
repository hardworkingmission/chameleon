'use client';

export type PresetId =
  | 'heic-to-jpg'
  | 'webp-to-png'
  | 'resize-300'
  | 'passport-photo'
  | 'compress-50'
  | 'compress-100'
  | 'remove-metadata';

interface QuickPresetsProps {
  onApply: (preset: PresetId) => void;
}

const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'heic-to-jpg', label: 'HEIC → JPG' },
  { id: 'webp-to-png', label: 'WebP → PNG' },
  { id: 'resize-300', label: 'Resize 300×300' },
  { id: 'passport-photo', label: 'Passport photo (2×2")' },
  { id: 'compress-50', label: 'Compress < 50 KB' },
  { id: 'compress-100', label: 'Compress < 100 KB' },
  { id: 'remove-metadata', label: 'Remove metadata' },
];

export default function QuickPresets({ onApply }: QuickPresetsProps) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="btn-secondary"
          style={{ borderRadius: 999, padding: '6px 14px', fontSize: 13 }}
          onClick={() => onApply(preset.id)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
