'use client';

import { useRef, useState, DragEvent, ChangeEvent } from 'react';

interface DropzoneProps {
  onFiles: (files: File[]) => void;
}

export default function Dropzone({ onFiles }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onFiles(files);
    e.target.value = '';
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '48px 24px',
        textAlign: 'center',
        cursor: 'pointer',
        background: dragging ? 'rgba(124,92,255,0.06)' : 'var(--bg-elevated)',
        transition: 'all 0.15s ease',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.heic,.heif,.pdf"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Drag &amp; drop files here</p>
      <p className="muted" style={{ fontSize: 14 }}>
        or click to browse — images, HEIC/HEIF, or PDF
      </p>
    </div>
  );
}
