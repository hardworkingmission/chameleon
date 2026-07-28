'use client';

interface QualitySliderProps {
  value: number;
  onChange: (value: number) => void;
}

export default function QualitySlider({ value, onChange }: QualitySliderProps) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label htmlFor="quality">Quality — {value}</label>
      <input
        id="quality"
        type="range"
        min={1}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}
