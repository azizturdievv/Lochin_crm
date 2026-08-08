'use client';

import { Lock, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { AccessStatus } from '@/types/payments';

interface Props {
  status: AccessStatus;
}

export default function PaymentLockBanner({ status }: Props) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center text-red-500 mb-5">
        <Lock size={32} />
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-1.5">
        Ilova vaqtincha yopilgan
      </h2>
      <p className="text-sm text-gray-500 max-w-sm">
        To'lov muddati o'tgan ({status.daysOverdue} kun). Dars materiallari, testlar,
        uy vazifasi va guruh chatlari to'lov amalga oshirilgunga qadar yopiq turadi.
      </p>
      <p className="text-xs text-gray-400 mt-2 max-w-sm">
        To'lovni markazda amalga oshiring — profil avtomatik ochiladi.
      </p>
      <button
        onClick={() => router.push('/dashboard/chat')}
        className="mt-6 flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
      >
        <MessageCircle size={16} />
        Administratsiya bilan bog'lanish
      </button>
    </div>
  );
}
