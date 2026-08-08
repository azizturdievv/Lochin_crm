'use client';

import { Pencil, Search, UserMinus, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';

interface GroupSummary {
  id: string;
  name: string;
  subject: { id: string; name: string } | null;
  teacher: { id: string; firstName: string; lastName: string } | null;
  roomNumber: string | null;
  lessonTime: { start: string; end: string } | null;
  maxStudents: number;
  currentStudents: number;
}

interface RosterRow {
  enrollmentId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  enrolledAt: string;
  discountPercent: number;
}

interface StudentOption { id: string; firstName: string; lastName: string; }

const fetchStudentOptions = (q: string) =>
  api.get<{ data: StudentOption[] }>('/students', { params: { search: q, limit: 8, isActive: true } }).then(r => r.data.data);

interface Props {
  group:   GroupSummary;
  onClose: () => void;
  onEdit:  () => void;
}

export default function GroupDetailModal({ group, onClose, onEdit }: Props) {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const dQuery = useDebounce(query, 350);

  const { data: roster, isLoading } = useQuery({
    queryKey: ['group-students', group.id],
    queryFn:  () => api.get<RosterRow[]>(`/groups/${group.id}/students`).then(r => r.data),
  });

  const { data: options } = useQuery({
    queryKey: ['group-enroll-search', dQuery],
    queryFn:  () => fetchStudentOptions(dQuery),
    enabled:  dQuery.length >= 2,
  });

  const rosterIds = new Set((roster ?? []).map(r => r.studentId));
  const results = (options ?? []).filter(o => !rosterIds.has(o.id));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['group-students', group.id] });
    qc.invalidateQueries({ queryKey: ['groups'] });
  };

  const enrollMut = useMutation({
    mutationFn: (studentId: string) => api.post(`/students/${studentId}/enroll`, { groupId: group.id }),
    onSuccess:  () => { invalidate(); setQuery(''); setError(''); },
    onError:    (e: { response?: { data?: { message?: string } } }) =>
      setError(e.response?.data?.message ?? 'Xatolik yuz berdi'),
  });

  const unenrollMut = useMutation({
    mutationFn: (row: RosterRow) => api.delete(`/students/${row.studentId}/enrollments/${row.enrollmentId}`),
    onSuccess:  invalidate,
  });

  const isFull = (roster?.length ?? group.currentStudents) >= group.maxStudents;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Sarlavha */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{group.name}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-500">
              {group.subject && (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{group.subject.name}</span>
              )}
              <span>{group.teacher ? `${group.teacher.lastName} ${group.teacher.firstName}` : 'Ustoz tayinlanmagan'}</span>
              <span className="text-gray-300">·</span>
              <span>{group.roomNumber ? `${group.roomNumber}-xona` : 'Xona tanlanmagan'}</span>
              {group.lessonTime && <span>{group.lessonTime.start}–{group.lessonTime.end}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} title="Sozlash (ustoz, xona, vaqt)"
              className="p-2 rounded-lg hover:bg-amber-50 text-amber-500 transition-colors">
              <Pencil size={18} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* O'quvchi qo'shish */}
        <div className="p-5 border-b border-gray-100 shrink-0">
          <label className="text-xs font-medium text-gray-600 mb-1 block">O'quvchi qo'shish</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={15} /></span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={isFull ? `Guruh to'lgan (${group.maxStudents}/${group.maxStudents})` : "Ism bo'yicha qidirish..."}
              disabled={isFull}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
            {query.length >= 2 && results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden max-h-48 overflow-y-auto">
                {results.map(s => (
                  <button key={s.id} type="button"
                    onClick={() => enrollMut.mutate(s.id)}
                    disabled={enrollMut.isPending}
                    className="w-full flex items-center justify-between text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 disabled:opacity-50"
                  >
                    <span>{s.lastName} {s.firstName}</span>
                    <UserPlus size={14} className="text-emerald-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
          {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
        </div>

        {/* Ro'yxat */}
        <div className="overflow-y-auto flex-1 p-5 pt-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            O'quvchilar ({roster?.length ?? group.currentStudents}/{group.maxStudents})
          </p>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !roster || roster.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Hali o'quvchi yo'q</p>
          ) : (
            <div className="space-y-1.5">
              {roster.map(r => (
                <div key={r.enrollmentId}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.lastName} {r.firstName}</p>
                    <p className="text-xs text-gray-400">
                      {r.phone ?? '—'} · {new Date(r.enrolledAt).toLocaleDateString('uz-UZ')}dan
                    </p>
                  </div>
                  <button
                    onClick={() => unenrollMut.mutate(r)}
                    disabled={unenrollMut.isPending}
                    title="Guruhdan chiqarish"
                    className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  >
                    <UserMinus size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
