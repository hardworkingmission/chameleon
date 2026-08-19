'use client';

import { TARGET_FORMATS } from '@/lib/formats';

interface FormatSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function FormatSelector({ value, onChange }: FormatSelectorProps) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label htmlFor="targetFormat">Convert to</label>
      <select
        id="targetFormat"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
        <option value="">Keep original format</option>
        {TARGET_FORMATS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
    </div>
  );
}
