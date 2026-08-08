'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('Global xato:', error);
  }, [error]);

  return (
    <html lang="uz">
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f9fafb',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '1rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '24rem',
              background: '#fff',
              borderRadius: '1rem',
              boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
              border: '1px solid #f0f0f0',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', margin: 0 }}>
              Ilova ishga tushmadi
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
              Kutilmagan xatolik yuz berdi. Sahifani qayta yuklab ko&apos;ring.
            </p>
            <button
              onClick={() => unstable_retry()}
              style={{
                marginTop: '1.5rem',
                width: '100%',
                padding: '0.625rem',
                background: '#4f46e5',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 500,
                borderRadius: '0.75rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Qayta urinish
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
