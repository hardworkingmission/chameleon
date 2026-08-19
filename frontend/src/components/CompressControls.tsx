'use client';

interface CompressControlsProps {
  maxSizeKB: string;
  onMaxSizeKBChange: (value: string) => void;
  stripMetadata: boolean;
  onStripMetadataChange: (value: boolean) => void;
}

export default function CompressControls({
  maxSizeKB,
  onMaxSizeKBChange,
  stripMetadata,
  onStripMetadataChange,
}: CompressControlsProps) {
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <div className="form-group" style={{ marginBottom: 0, width: 160 }}>
        <label htmlFor="maxSizeKB">Compress under (KB)</label>
        <input
          id="maxSizeKB"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 50"
          value={maxSizeKB}
          onChange={(e) => onMaxSizeKBChange(e.target.value.replace(/[^\d]/g, ''))}
        />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={stripMetadata}
          onChange={(e) => onStripMetadataChange(e.target.checked)}
        />
        Remove metadata (EXIF, GPS, etc.)
      </label>
    </div>
  );
}
