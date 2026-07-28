'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function NavBar() {
  const { user, logout, loading } = useAuth();

  return (
    <header
      style={{
        borderBottom: '1px solid var(--border)',
        padding: '16px 20px',
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link href="/" style={{ fontWeight: 700, fontSize: 18 }}>
          🦎 Chameleon
        </Link>
        <nav style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 14 }}>
          {!loading && user && (
            <>
              <Link href="/history" className="muted">
                History
              </Link>
              <span className="muted">{user.email}</span>
              <button className="btn btn-secondary" onClick={() => logout()}>
                Log out
              </button>
            </>
          )}
          {!loading && !user && (
            <>
              <Link href="/login" className="muted">
                Log in
              </Link>
              <Link href="/register" className="btn">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
