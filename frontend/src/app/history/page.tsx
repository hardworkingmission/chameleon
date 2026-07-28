'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiGet } from '@/lib/api';

interface HistoryItem {
  id: number;
  originalFilename: string;
  sourceFormat: string;
  targetFormat: string;
  fileSizeBytes: number;
  status: 'SUCCESS' | 'FAILED';
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiGet('/api/history')
      .then((res) => setItems(res.items))
      .catch(() => setError('Could not load conversion history.'))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || !user) return null;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Conversion history</h1>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && items.length === 0 && <p className="muted">No conversions yet.</p>}
      {items.length > 0 && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px 12px' }}>File</th>
                <th style={{ padding: '8px 12px' }}>From</th>
                <th style={{ padding: '8px 12px' }}>To</th>
                <th style={{ padding: '8px 12px' }}>Size</th>
                <th style={{ padding: '8px 12px' }}>Status</th>
                <th style={{ padding: '8px 12px' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}>{item.originalFilename}</td>
                  <td style={{ padding: '8px 12px' }}>{item.sourceFormat}</td>
                  <td style={{ padding: '8px 12px' }}>{item.targetFormat}</td>
                  <td style={{ padding: '8px 12px' }}>{formatBytes(item.fileSizeBytes)}</td>
                  <td style={{ padding: '8px 12px', color: item.status === 'SUCCESS' ? 'var(--success)' : 'var(--error)' }}>
                    {item.status}
                  </td>
                  <td style={{ padding: '8px 12px' }}>{new Date(item.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
