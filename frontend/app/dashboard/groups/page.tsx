'use client';

import { AlertTriangle, Archive, CalendarX2, Pencil, School, Search, X } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import GroupDetailModal from '@/components/groups/GroupDetailModal';
import type { MonthGenerationStatus } from '@/types/schedule';

// ─── TURLARI ──────────────────────────────────────────────────────────────────
interface Subject { id: string; name: string; }
interface Teacher { id: string; firstName: string; lastName: string; }
interface Room { id: string; name: string; number: string; capacity: number; }
interface Group {
  id: string;
  name: string;
  subject: Subject | null;
  teacher: Teacher | null;
  roomNumber: string | null;
  lessonTime: { start: string; end: string } | null;
  lessonDays: string[];
  monthlyPrice: number;
  maxStudents: number;
  currentStudents: number;
  isActive: boolean;
}
interface GroupsResponse { data: Group[]; total: number; totalPages: number; }
interface GroupForm {
  name: string;
  subjectId: string;
  teacherId: string;
  roomNumber: string;
  lessonStartTime: string;
  lessonEndTime: string;
  lessonDays: string[];
  monthlyPrice: string;
  maxStudents: string;
}

// ─── KUNLAR ───────────────────────────────────────────────────────────────────
const DAYS = [
  { value: 'monday',    label: 'Du' },
  { value: 'tuesday',   label: 'Se' },
  { value: 'wednesday', label: 'Cho' },
  { value: 'thursday',  label: 'Pa' },
  { value: 'friday',    label: 'Ju' },
  { value: 'saturday',  label: 'Sha' },
  { value: 'sunday',    label: 'Ya' },
];

const DAYS_SHORT: Record<string, string> = {
  monday: 'Du', tuesday: 'Se', wednesday: 'Cho',
  thursday: 'Pa', friday: 'Ju', saturday: 'Sha', sunday: 'Ya',
};

// ─── BOSHLANG'ICH QIYMAT ──────────────────────────────────────────────────────
const EMPTY: GroupForm = {
  name: '', subjectId: '', teacherId: '', roomNumber: '',
  lessonStartTime: '08:00', lessonEndTime: '10:00',
  lessonDays: [], monthlyPrice: '', maxStudents: '12',
};

const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition';
const LABEL = 'block text-xs font-medium text-gray-600 mb-1';
const ERROR_CLS = 'text-red-500 text-xs mt-0.5';

// ─── ASOSIY SAHIFA ────────────────────────────────────────────────────────────
export default function GroupsPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [modal, setModal]   = useState<{ open: boolean; group: Group | null }>({ open: false, group: null });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailGroup, setDetailGroup] = useState<Group | null>(null);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterActive, setFilterActive]   = useState('true');
  // Global qidiruv (⌘K) orqali "?q=" bilan kelinsa, boshlang'ich qidiruv shu bo'ladi
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [page, setPage]     = useState(1);

  // Guruhlar
  const { data, isLoading } = useQuery({
    queryKey: ['groups', { filterSubject, filterActive, search, page }],
    queryFn: () =>
      api.get<GroupsResponse>('/groups', {
        params: {
          ...(filterSubject && { subjectId: filterSubject }),
          ...(filterActive && { isActive: filterActive }),
          ...(search && { search }),
          page,
          limit: 20,
        },
      }).then(r => r.data),
    placeholderData: p => p,
  });

  // Fanlar dropdown uchun
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.get<Subject[]>('/subjects').then(r => r.data),
  });

  // Joriy oy uchun qaysi guruhlarning jadvali to'liq emasligi (Jadval
  // sahifasidagi banner bilan bir xil endpoint — "N kun yetishmayapti" belgisi)
  const currentMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();
  const { data: monthStatus } = useQuery({
    queryKey: ['month-status', currentMonth],
    queryFn: () => api.get<MonthGenerationStatus[]>('/schedule/month-status', { params: { month: currentMonth } }).then(r => r.data),
  });
  const monthStatusMap = new Map((monthStatus ?? []).map(s => [s.groupId, s]));

  // Deaktivatsiya
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/groups/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }); setDeleteId(null); },
  });

  const groups = data?.data ?? [];
  const total  = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-5">

      {/* ── SARLAVHA ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Guruhlar</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Jami: <span className="font-medium text-gray-700">{total}</span> ta
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, group: null })}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
        >
          <span>+</span> Yangi guruh
        </button>
      </div>

      {/* ── FILTER ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"><Search size={16} /></span>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Guruh nomi..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={filterSubject}
            onChange={e => { setFilterSubject(e.target.value); setPage(1); }}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white min-w-36"
          >
            <option value="">Barcha fanlar</option>
            {(subjects as Subject[] | undefined)?.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={filterActive}
            onChange={e => { setFilterActive(e.target.value); setPage(1); }}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="true">Faol</option>
            <option value="false">Arxivlangan</option>
            <option value="">Barchasi</option>
          </select>
        </div>
      </div>

      {/* ── GURUHLAR JADVALI ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Guruh</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Fan</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Ustoz</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Xona / Vaqt</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">O'quvchi</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Narx</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-400">
                    <div className="text-5xl mb-3"><School size={16} /></div>
                    <p className="font-medium text-gray-500">Guruh topilmadi</p>
                    <p className="text-sm mt-1">Yangi guruh yarating</p>
                  </td>
                </tr>
              ) : groups.map(g => (
                <tr key={g.id}
                  onClick={() => setDetailGroup(g)}
                  className="hover:bg-gray-50/60 transition-colors group cursor-pointer"
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                        <span className="text-emerald-700 text-xs font-bold">
                          {g.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{g.name}</p>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {g.lessonDays.map(d => (
                            <span key={d} className="text-xs text-emerald-600 bg-emerald-50 px-1 rounded">
                              {DAYS_SHORT[d] ?? d}
                            </span>
                          ))}
                          {g.isActive && <ScheduleBadge group={g} status={monthStatusMap.get(g.id)} />}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {g.subject?.name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-gray-600 text-sm hidden lg:table-cell">
                    {g.teacher
                      ? `${g.teacher.lastName} ${g.teacher.firstName}`
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <p className="text-gray-700 text-sm">{g.roomNumber ?? '—'}</p>
                    {g.lessonTime && (
                      <p className="text-gray-400 text-xs">{g.lessonTime.start}–{g.lessonTime.end}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-gray-700">{g.currentStudents}</span>
                      <span className="text-gray-400 text-xs">/ {g.maxStudents}</span>
                    </div>
                    <div className="w-16 bg-gray-100 rounded-full h-1 mt-1">
                      <div
                        className="bg-emerald-500 h-1 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (g.currentStudents / g.maxStudents) * 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-sm font-medium text-gray-700">
                      {g.monthlyPrice > 0 ? `${(g.monthlyPrice).toLocaleString('uz-UZ')} so'm` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setModal({ open: true, group: g }); }}
                        className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 transition-colors text-sm"
                        title="Tahrirlash"
                      ><Pencil size={16} /></button>
                      {g.isActive && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteId(g.id); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors text-sm"
                          title="Arxivlash"
                        ><Archive size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">{total} ta guruh</p>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="w-8 h-8 rounded-lg text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition-colors">‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>
                  {p}
                </button>
              ))}
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="w-8 h-8 rounded-lg text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition-colors">›</button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL ─────────────────────────────────────────────────── */}
      {modal.open && (
        <GroupModal
          group={modal.group}
          subjects={subjects as Subject[] | undefined}
          onClose={() => setModal({ open: false, group: null })}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['groups'] });
            setModal({ open: false, group: null });
          }}
        />
      )}

      {/* ── GURUH TAFSILOTI (O'QUVCHILAR RO'YXATI) ─────────────────── */}
      {detailGroup && !modal.open && (
        <GroupDetailModal
          group={detailGroup}
          onClose={() => setDetailGroup(null)}
          onEdit={() => { setModal({ open: true, group: detailGroup }); setDetailGroup(null); }}
        />
      )}

      {/* ── O'CHIRISH TASDIQLASH ───────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="text-3xl mb-3"><AlertTriangle size={30} /></div>
            <h3 className="font-semibold text-gray-900 mb-1">Guruhni arxivlash</h3>
            <p className="text-gray-500 text-sm mb-5">Guruh arxivlanadi. Ma'lumotlar saqlanib qoladi.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Bekor
              </button>
              <button onClick={() => deleteMut.mutate(deleteId!)} disabled={deleteMut.isPending}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium disabled:opacity-60 transition">
                {deleteMut.isPending ? 'Arxivlanmoqda...' : 'Arxivlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── JADVAL HOLATI BELGISI ────────────────────────────────────────────────────
// Kun/vaqt/xona umuman sozlanmagan bo'lsa — neytral eslatma (shoshilinch emas,
// "keyinroq belgilayman" holati). Sozlangan-u, joriy oy uchun konflikt yoki
// hali generatsiya qilinmagani sababli kunlar yetishmasa — amber, harakat talab
// qiladigan belgi. Ikkalasi ham Jadval sahifasidagi bannerga olib boradi.
function ScheduleBadge({ group, status }: { group: Group; status?: MonthGenerationStatus }) {
  const noPattern = !group.lessonDays.length || !group.lessonTime || !group.roomNumber;

  if (noPattern) {
    return (
      <Link
        href="/dashboard/schedule"
        onClick={e => e.stopPropagation()}
        title="Dars kunlari, vaqti yoki xonasi hali sozlanmagan"
        className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-1.5 py-0.5 rounded transition-colors"
      >
        <CalendarX2 size={10} /> Jadval yo'q
      </Link>
    );
  }

  if (status && status.missing > 0) {
    return (
      <Link
        href="/dashboard/schedule"
        onClick={e => e.stopPropagation()}
        title={`Bu oy uchun ${status.missing} kunlik dars hali yaratilmagan`}
        className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded transition-colors"
      >
        <AlertTriangle size={10} /> {status.missing} kun yo'q
      </Link>
    );
  }

  return null;
}

// ─── GURUH MODAL ──────────────────────────────────────────────────────────────
function GroupModal({
  group, subjects, onClose, onSaved,
}: {
  group: Group | null;
  subjects?: Subject[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!group;
  const [form, setForm] = useState<GroupForm>(() =>
    group
      ? {
          name:            group.name,
          subjectId:       group.subject?.id ?? '',
          teacherId:       group.teacher?.id ?? '',
          roomNumber:      group.roomNumber ?? '',
          lessonStartTime: group.lessonTime?.start ?? '08:00',
          lessonEndTime:   group.lessonTime?.end   ?? '10:00',
          lessonDays:      group.lessonDays,
          monthlyPrice:    String(group.monthlyPrice),
          maxStudents:     String(group.maxStudents),
        }
      : { ...EMPTY }
  );
  const [error, setError] = useState('');

  // O'qituvchilar ro'yxati (paginated javob ichidan data massiv olinadi)
  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: () =>
      api.get<{ data: Teacher[] }>('/users', { params: { role: 'ustoz', limit: 100 } })
        .then(r => r.data.data),
  });

  // Xonalar ro'yxati (Sozlamalar bo'limida boshqariladi)
  const { data: rooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get<Room[]>('/schedule/rooms?active=true').then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const saveMut = useMutation({
    mutationFn: (payload: object) =>
      isEdit
        ? api.patch(`/groups/${group!.id}`, payload).then(r => r.data)
        : api.post('/groups', payload).then(r => r.data),
    onSuccess: onSaved,
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Xatolik yuz berdi'));
    },
  });

  function toggleDay(val: string) {
    setForm(f => ({
      ...f,
      lessonDays: f.lessonDays.includes(val)
        ? f.lessonDays.filter(d => d !== val)
        : [...f.lessonDays, val],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError("Guruh nomi to'ldirilishi shart"); return; }
    if (!form.subjectId)   { setError("Fan tanlanishi shart"); return; }

    saveMut.mutate({
      name:            form.name.trim(),
      subjectId:       form.subjectId,
      teacherId:       form.teacherId || undefined,
      roomNumber:      form.roomNumber || undefined,
      lessonStartTime: form.lessonStartTime || undefined,
      lessonEndTime:   form.lessonEndTime || undefined,
      lessonDays:      form.lessonDays,
      monthlyPrice:    form.monthlyPrice ? Number(form.monthlyPrice) : 0,
      maxStudents:     form.maxStudents ? Number(form.maxStudents) : 12,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Guruhni tahrirlash' : 'Yangi guruh'}
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"><X size={16} /></button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Guruh nomi */}
          <div>
            <label className={LABEL}>Guruh nomi *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={INPUT}
              placeholder="Masalan: Ingliz tili A1-1"
            />
          </div>

          {/* Fan */}
          <div>
            <label className={LABEL}>Fan *</label>
            <select
              value={form.subjectId}
              onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}
              className={INPUT}
            >
              <option value="">Fan tanlang</option>
              {subjects?.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* O'qituvchi */}
          <div>
            <label className={LABEL}>O'qituvchi</label>
            <select
              value={form.teacherId}
              onChange={e => setForm(f => ({ ...f, teacherId: e.target.value }))}
              className={INPUT}
            >
              <option value="">O'qituvchi tanlang</option>
              {(teachers as Teacher[] | undefined)?.map(t => (
                <option key={t.id} value={t.id}>
                  {t.lastName} {t.firstName}
                </option>
              ))}
            </select>
          </div>

          {/* Xona */}
          <div>
            <label className={LABEL}>Xona</label>
            <select
              value={form.roomNumber}
              onChange={e => setForm(f => ({ ...f, roomNumber: e.target.value }))}
              className={INPUT}
            >
              <option value="">Tanlang...</option>
              {(rooms ?? []).map(r => (
                <option key={r.id} value={r.number}>
                  {r.name} ({r.capacity} o'rin)
                </option>
              ))}
            </select>
          </div>

          {/* Vaqt */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Dars boshlanishi</label>
              <input
                type="time"
                value={form.lessonStartTime}
                onChange={e => setForm(f => ({ ...f, lessonStartTime: e.target.value }))}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Dars tugashi</label>
              <input
                type="time"
                value={form.lessonEndTime}
                onChange={e => setForm(f => ({ ...f, lessonEndTime: e.target.value }))}
                className={INPUT}
              />
            </div>
          </div>

          {/* Dars kunlari */}
          <div>
            <label className={LABEL}>Haftalik kunlar</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {DAYS.map(d => (
                <label key={d.value} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.lessonDays.includes(d.value)}
                    onChange={() => toggleDay(d.value)}
                    className="accent-primary-600 w-4 h-4"
                  />
                  <span className={`text-sm font-medium px-2 py-0.5 rounded-lg transition-colors ${
                    form.lessonDays.includes(d.value)
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'text-gray-600'
                  }`}>
                    {d.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Narx va sig'im */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Oylik narx (so'm)</label>
              <input
                type="number"
                value={form.monthlyPrice}
                onChange={e => setForm(f => ({ ...f, monthlyPrice: e.target.value }))}
                className={INPUT}
                placeholder="500000"
                min={0}
              />
            </div>
            <div>
              <label className={LABEL}>Max o'quvchi soni</label>
              <input
                type="number"
                value={form.maxStudents}
                onChange={e => setForm(f => ({ ...f, maxStudents: e.target.value }))}
                className={INPUT}
                placeholder="12"
                min={1}
                max={200}
              />
            </div>
          </div>

          {/* Xato */}
          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</p>
          )}

          {/* Tugmalar */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Bekor
            </button>
            <button type="submit" disabled={saveMut.isPending}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition">
              {saveMut.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
