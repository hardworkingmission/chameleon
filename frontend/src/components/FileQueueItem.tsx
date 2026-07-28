'use client';

import { QueueFile } from '@/lib/queue';

interface FileQueueItemProps {
  item: QueueFile;
  onRemove: (id: string) => void;
  onDownload: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileQueueItem({ item, onRemove, onDownload }: FileQueueItemProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          overflow: 'hidden',
          background: 'var(--bg)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
        }}
      >
        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          '📄'
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.file.name}
        </p>
        <p className="muted" style={{ fontSize: 12 }}>
          {formatBytes(item.file.size)}
          {item.status === 'error' && item.error ? ` — ${item.error}` : ''}
        </p>
        {item.status === 'uploading' && (
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 6 }}>
            <div
              style={{
                height: '100%',
                width: `${item.progress}%`,
                background: 'var(--accent)',
                borderRadius: 2,
                transition: 'width 0.15s ease',
              }}
            />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {item.status === 'done' && (
          <button className="btn btn-secondary" onClick={() => onDownload(item.id)}>
            Download
          </button>
        )}
        {item.status === 'error' && <span style={{ color: 'var(--error)', fontSize: 13 }}>Failed</span>}
        {(item.status === 'pending' || item.status === 'error' || item.status === 'done') && (
          <button
            className="btn-secondary"
            style={{ border: 'none', background: 'none', fontSize: 18, padding: 4 }}
            onClick={() => onRemove(item.id)}
            aria-label="Remove"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
