'use client';

interface DownloadBarProps {
  doneCount: number;
  totalCount: number;
  onDownloadZip: () => void;
  zipping: boolean;
}

export default function DownloadBar({ doneCount, totalCount, onDownloadZip, zipping }: DownloadBarProps) {
  if (doneCount === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
        padding: '12px 16px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}
    >
      <span className="muted" style={{ fontSize: 14 }}>
        {doneCount} of {totalCount} converted
      </span>
      {doneCount > 1 && (
        <button className="btn" onClick={onDownloadZip} disabled={zipping}>
          {zipping ? 'Zipping…' : 'Download all as ZIP'}
        </button>
      )}
    </div>
  );
}
