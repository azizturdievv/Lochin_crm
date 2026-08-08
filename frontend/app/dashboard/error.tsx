'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard xatosi:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="text-red-500" size={26} />
        </div>
        <h2 className="text-base font-semibold text-gray-900">Nimadir noto&apos;g&apos;ri ketdi</h2>
        <p className="text-sm text-gray-500 mt-1.5">
          Sahifa yuklanishida kutilmagan xatolik yuz berdi. Qayta urinib ko&apos;ring — muammo davom
          etsa, administratorga xabar bering.
        </p>

        <div className="flex flex-col gap-2 mt-6">
          <button
            onClick={() => unstable_retry()}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <RotateCw size={15} /> Qayta urinish
          </button>
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 w-full py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl transition-colors"
          >
            <Home size={15} /> Bosh sahifaga qaytish
          </Link>
        </div>
      </div>
    </div>
  );
}
