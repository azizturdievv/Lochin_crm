'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface Group {
  id: string;
  name: string;
  subject: { name: string } | null;
  teacher: { firstName: string; lastName: string } | null;
  lessonTime: { start: string; end: string } | null;
  lessonDays: string[];
  monthlyPrice: number;
  currentStudents: number;
  maxStudents: number;
  isActive: boolean;
}

const DAYS_SHORT: Record<string, string> = {
  monday: 'Du', tuesday: 'Se', wednesday: 'Cho',
  thursday: 'Pa', friday: 'Ju', saturday: 'Sha', sunday: 'Ya',
};

interface Props {
  studentId: string;
  studentName: string;
  onClose: () => void;
}

export default function EnrollModal({ studentId, studentName, onClose }: Props) {
  const qc = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [error, setError] = useState('');

  // Faol guruhlar
  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups-for-enroll'],
    queryFn: () =>
      api.get<{ data: Group[] }>('/groups', { params: { isActive: 'true', limit: 100 } })
        .then(r => r.data.data),
  });

  // Tanlangan guruh
  const selectedGroup = groups?.find(g => g.id === selectedGroupId);

  const enrollMut = useMutation({
    mutationFn: () =>
      api.post(`/students/${studentId}/enroll`, {
        groupId: selectedGroupId,
        discountPercent: Number(discountPercent) || 0,
      }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['student', studentId] });
      onClose();
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Xatolik yuz berdi'));
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Guruhga yozish</h2>
            <p className="text-sm text-gray-500 mt-0.5">{studentName}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Guruh tanlash */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Guruh tanlang *
            </label>
            {isLoading ? (
              <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            ) : (
              <select
                value={selectedGroupId}
                onChange={e => { setSelectedGroupId(e.target.value); setError(''); }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Guruh tanlang</option>
                {groups?.map(g => (
                  <option key={g.id} value={g.id} disabled={g.currentStudents >= g.maxStudents}>
                    {g.name} — {g.subject?.name}
                    {g.currentStudents >= g.maxStudents ? ' (To\'liq)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Guruh ma'lumotlari — tanlanganda ko'rinadi */}
          {selectedGroup && (
            <div className="bg-emerald-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Fan</span>
                <span className="text-sm font-medium text-gray-800">{selectedGroup.subject?.name ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Ustoz</span>
                <span className="text-sm font-medium text-gray-800">
                  {selectedGroup.teacher
                    ? `${selectedGroup.teacher.lastName} ${selectedGroup.teacher.firstName}`
                    : <span className="text-gray-400">Belgilanmagan</span>}
                </span>
              </div>
              {selectedGroup.lessonTime && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Vaqt</span>
                  <span className="text-sm text-gray-800">
                    {selectedGroup.lessonTime.start}–{selectedGroup.lessonTime.end}
                  </span>
                </div>
              )}
              {selectedGroup.lessonDays.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Kunlar</span>
                  <div className="flex gap-1">
                    {selectedGroup.lessonDays.map(d => (
                      <span key={d} className="text-xs bg-white text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                        {DAYS_SHORT[d] ?? d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Narx / oy</span>
                <span className="text-sm font-semibold text-emerald-700">
                  {selectedGroup.monthlyPrice > 0
                    ? `${selectedGroup.monthlyPrice.toLocaleString('uz-UZ')} so'm`
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">O'quvchilar</span>
                <span className="text-sm text-gray-800">
                  {selectedGroup.currentStudents} / {selectedGroup.maxStudents}
                </span>
              </div>
            </div>
          )}

          {/* Chegirma */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Chegirma (%)
            </label>
            <input
              type="number"
              value={discountPercent}
              onChange={e => setDiscountPercent(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="0"
              min={0}
              max={100}
            />
          </div>

          {/* Xato */}
          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</p>
          )}

          {/* Tugmalar */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Bekor
            </button>
            <button
              onClick={() => {
                if (!selectedGroupId) { setError('Guruh tanlang'); return; }
                enrollMut.mutate();
              }}
              disabled={enrollMut.isPending || !selectedGroupId}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition"
            >
              {enrollMut.isPending ? 'Yozilmoqda...' : 'Guruhga yozish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
