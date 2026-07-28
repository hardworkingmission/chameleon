'use client';

export interface ResizeValue {
  width: string;
  height: string;
  fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

interface ResizeControlsProps {
  value: ResizeValue;
  onChange: (value: ResizeValue) => void;
}

export default function ResizeControls({ value, onChange }: ResizeControlsProps) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div className="form-group" style={{ marginBottom: 0, width: 100 }}>
        <label htmlFor="resize-width">Width (px)</label>
        <input
          id="resize-width"
          type="text"
          inputMode="numeric"
          placeholder="auto"
          value={value.width}
          onChange={(e) => onChange({ ...value, width: e.target.value.replace(/[^\d]/g, '') })}
        />
      </div>
      <div className="form-group" style={{ marginBottom: 0, width: 100 }}>
        <label htmlFor="resize-height">Height (px)</label>
        <input
          id="resize-height"
          type="text"
          inputMode="numeric"
          placeholder="auto"
          value={value.height}
          onChange={(e) => onChange({ ...value, height: e.target.value.replace(/[^\d]/g, '') })}
        />
      </div>
      {(value.width || value.height) && (
        <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
          <label htmlFor="resize-fit">Fit</label>
          <select
            id="resize-fit"
            value={value.fit}
            onChange={(e) => onChange({ ...value, fit: e.target.value as ResizeValue['fit'] })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 14,
            }}
          >
            <option value="inside">Fit inside (keep aspect ratio)</option>
            <option value="cover">Cover (crop to fill)</option>
            <option value="contain">Contain (pad to fit)</option>
            <option value="fill">Stretch to exact size</option>
            <option value="outside">Fit outside</option>
          </select>
        </div>
      )}
    </div>
  );
}
