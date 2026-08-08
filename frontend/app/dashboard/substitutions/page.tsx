'use client';

import { ArrowRight, BookOpen, ClipboardList, Plus, RefreshCw, Thermometer, Trash2, User, Users, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// ─── Tiplar ──────────────────────────────────────────────────────────────────
type AbsenceReason = 'sick' | 'personal' | 'family' | 'training' | 'other';

interface SubLesson {
  id:          string;
  lessonDate:  string;
  startTime:   string;
  endTime:     string;
  group?:      { name: string; subject?: { name: string } };
}

interface SubUser {
  id:        string;
  firstName: string;
  lastName:  string;
}

interface Substitution {
  id:                string;
  lessonId:          string;
  lesson?:           SubLesson;
  originalTeacherId: string;
  originalTeacher?:  SubUser;
  substituteTeacherId:string;
  substituteTeacher?: SubUser;
  reason:            AbsenceReason;
  notes:             string | null;
  subPayment:        string;
  originalDeduction: string;
  salaryProcessed:   boolean;
  notificationSent:  boolean;
  createdAt:         string;
}

interface CreateSubDto {
  lessonId:             string;
  originalTeacherId:    string;
  substituteTeacherId:  string;
  reason:               AbsenceReason;
  notes?:               string;
}

// ─── Meta ─────────────────────────────────────────────────────────────────────
const REASON_META: Record<AbsenceReason, { label: string; icon: LucideIcon; color: string }> = {
  sick:     { label: 'Kasal',        icon: Thermometer, color: 'text-red-600'    },
  personal: { label: 'Shaxsiy',      icon: User, color: 'text-blue-600'   },
  family:   { label: 'Oilaviy',      icon: Users, color: 'text-amber-600'  },
  training: { label: "O'qitish",     icon: BookOpen, color: 'text-purple-600' },
  other:    { label: 'Boshqa',       icon: ClipboardList, color: 'text-gray-600'   },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('uz-UZ', { day:'2-digit', month:'short', year:'numeric' });
}

function fmtMoney(val: string | bigint) {
  return Number(val).toLocaleString('uz-UZ');
}

// ─── Sahifa ──────────────────────────────────────────────────────────────────
export default function SubstitutionsPage() {
  const user    = useAuthStore(s => s.user);
  const qc      = useQueryClient();
  const isSA    = user?.role === 'super_admin';

  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ['substitutions', dateFrom, dateTo],
    queryFn:  () => api.get('/substitutions', {
      params: {
        dateFrom: dateFrom || undefined,
        dateTo:   dateTo   || undefined,
      },
    }).then(r => {
      const d = r.data;
      return (Array.isArray(d) ? d : (d?.data ?? d?.items ?? [])) as Substitution[];
    }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/substitutions/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['substitutions'] }),
  });

  // Statistika
  const totalSub = BigInt(subs.reduce((s, x) => s + Number(x.subPayment), 0));
  const totalDed = BigInt(subs.reduce((s, x) => s + Number(x.originalDeduction), 0));
  const processed = subs.filter(s => s.salaryProcessed).length;

  return (
    <div className="flex flex-col h-full">
      {/* ─── Sarlavha ─────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 bg-white border-b border-gray-100 shrink-0 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center text-white text-xl shrink-0"><RefreshCw size={16} /></div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">O'rinbosarlik</h1>
              <p className="text-xs text-gray-400">{subs.length} ta yozuv</p>
            </div>
          </div>
          {(isSA || user?.role === 'manager') && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              <Plus size={16} /> O'rinbosar tayinlash
            </button>
          )}
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-indigo-50 rounded-2xl p-3 text-center">
            <div className="text-xl font-bold text-indigo-700">{subs.length}</div>
            <div className="text-[10px] text-indigo-600">Jami o'rinbosarlik</div>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-3 text-center">
            <div className="text-xl font-bold text-emerald-700">{processed}</div>
            <div className="text-[10px] text-emerald-600">Ish haqi hisoblandi</div>
          </div>
          <div className="bg-blue-50 rounded-2xl p-3 text-center">
            <div className="text-sm font-bold text-blue-700">{fmtMoney(totalSub)}</div>
            <div className="text-[10px] text-blue-600">O'rinbosar to'lovi (so'm)</div>
          </div>
          <div className="bg-amber-50 rounded-2xl p-3 text-center">
            <div className="text-sm font-bold text-amber-700">{fmtMoney(totalDed)}</div>
            <div className="text-[10px] text-amber-600">Chegirma (so'm)</div>
          </div>
        </div>

        {/* Sana filtri */}
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Dan:</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Gacha:</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Tozalash
            </button>
          )}
        </div>
      </div>

      {/* ─── Ro'yxat ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : subs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
            <div className="text-5xl"><RefreshCw size={16} /></div>
            <p className="text-sm font-medium text-gray-500">O'rinbosarlik yozuvlari topilmadi</p>
            {(isSA || user?.role === 'manager') && (
              <button
                onClick={() => setCreateOpen(true)}
                className="text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-xl transition-colors"
              >
                <Plus size={16} /> Birinchi yozuv qo'shish
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {subs.map(sub => {
              const rm = REASON_META[sub.reason];
              return (
                <div key={sub.id} className="bg-white border border-gray-100 rounded-2xl px-5 py-4 hover:border-gray-200 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Dars */}
                      {sub.lesson && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">
                            {sub.lesson.group?.subject?.name ?? 'Dars'}
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className="text-xs text-gray-500">{sub.lesson.group?.name}</span>
                          <span className="text-gray-300">·</span>
                          <span className="text-xs text-gray-500">
                            {fmtDate(sub.lesson.lessonDate)} {sub.lesson.startTime}–{sub.lesson.endTime}
                          </span>
                        </div>
                      )}

                      {/* O'qituvchilar */}
                      <div className="flex items-center gap-3 text-xs flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400">Asl ustoz:</span>
                          <span className="font-medium text-gray-700">
                            {sub.originalTeacher
                              ? `${sub.originalTeacher.firstName} ${sub.originalTeacher.lastName}`
                              : '—'}
                          </span>
                        </div>
                        <ArrowRight size={14} className="text-gray-300" />
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400">O'rinbosar:</span>
                          <span className="font-medium text-emerald-700">
                            {sub.substituteTeacher
                              ? `${sub.substituteTeacher.firstName} ${sub.substituteTeacher.lastName}`
                              : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`text-[11px] font-medium ${rm.color}`}>
                          <rm.icon size={14} className="shrink-0" /> {rm.label}
                        </span>
                        {sub.notes && (
                          <span className="text-[11px] text-gray-400 italic">"{sub.notes}"</span>
                        )}
                      </div>
                    </div>

                    {/* O'ng: maosh + holat */}
                    <div className="shrink-0 text-right space-y-1">
                      <div className="text-sm font-bold text-emerald-700">
                        +{fmtMoney(sub.subPayment)} so'm
                      </div>
                      <div className="text-[11px] text-red-500">
                        -{fmtMoney(sub.originalDeduction)} so'm
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-2">
                        {sub.salaryProcessed
                          ? <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Hisoblandi</span>
                          : <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⏳ Kutmoqda</span>}
                        {(isSA || user?.role === 'manager') && !sub.salaryProcessed && (
                          <button
                            onClick={() => confirm("O'chirishni tasdiqlaysizmi?") && deleteMut.mutate(sub.id)}
                            disabled={deleteMut.isPending}
                            className="text-[10px] text-gray-400 hover:text-red-500 w-5 h-5 rounded flex items-center justify-center transition-colors"
                          ><Trash2 size={16} /></button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {createOpen && <CreateSubModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

// ─── O'rinbosar tayinlash modali ──────────────────────────────────────────────
function CreateSubModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<CreateSubDto>>({ reason: 'sick' });
  const [error, setError] = useState('');

  // Ustozlar ro'yxati
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-list'],
    queryFn:  () => api.get('/users', { params: { role: 'ustoz', limit: 100, isActive: true } })
      .then(r => {
        const d = r.data;
        return (Array.isArray(d) ? d : (d?.data ?? [])) as { id: string; firstName: string; lastName: string }[];
      }),
  });

  // Darslar ro'yxati (bugun va kelajak)
  const { data: lessons = [] } = useQuery({
    queryKey: ['upcoming-lessons'],
    queryFn:  () => api.get('/schedule/week').then(r => {
      const d = r.data;
      return (Array.isArray(d) ? d : (d?.data ?? d?.lessons ?? [])) as {
        id: string; lessonDate: string; startTime: string;
        group?: { name: string; subject?: { name: string } };
        teacher?: { firstName: string; lastName: string };
      }[];
    }),
  });

  const mut = useMutation({
    mutationFn: () => api.post('/substitutions', form),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['substitutions'] });
      onClose();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e.response?.data?.message ?? 'Xatolik yuz berdi'),
  });

  function handleSubmit() {
    setError('');
    if (!form.lessonId)             { setError('Dars tanlang'); return; }
    if (!form.originalTeacherId)    { setError('Asl o\'qituvchi tanlang'); return; }
    if (!form.substituteTeacherId)  { setError('O\'rinbosar tanlang'); return; }
    if (form.originalTeacherId === form.substituteTeacherId) {
      setError('Asl va o\'rinbosar bir xil bo\'lmasligi kerak'); return;
    }
    mut.mutate();
  }

  const INPUT = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white';
  const LABEL = 'text-xs font-medium text-gray-600 mb-1 block';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">O'rinbosar tayinlash</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 flex items-center justify-center transition-colors"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Dars tanlash */}
          <div>
            <label className={LABEL}>Dars *</label>
            <select
              value={form.lessonId ?? ''}
              onChange={e => {
                const lesson = lessons.find(l => l.id === e.target.value);
                setForm(f => ({
                  ...f,
                  lessonId: e.target.value,
                  originalTeacherId: lesson?.teacher
                    ? teachers.find(t =>
                        t.firstName === lesson.teacher?.firstName &&
                        t.lastName  === lesson.teacher?.lastName
                      )?.id
                    : f.originalTeacherId,
                }));
              }}
              className={INPUT}
            >
              <option value="">Dars tanlang...</option>
              {lessons.map(l => (
                <option key={l.id} value={l.id}>
                  {l.lessonDate} {l.startTime} — {l.group?.subject?.name ?? ''} ({l.group?.name ?? ''})
                </option>
              ))}
            </select>
          </div>

          {/* Asl o'qituvchi */}
          <div>
            <label className={LABEL}>Asl o'qituvchi *</label>
            <select
              value={form.originalTeacherId ?? ''}
              onChange={e => setForm(f => ({ ...f, originalTeacherId: e.target.value }))}
              className={INPUT}
            >
              <option value="">Tanlang...</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
              ))}
            </select>
          </div>

          {/* O'rinbosar */}
          <div>
            <label className={LABEL}>O'rinbosar ustoz *</label>
            <select
              value={form.substituteTeacherId ?? ''}
              onChange={e => setForm(f => ({ ...f, substituteTeacherId: e.target.value }))}
              className={INPUT}
            >
              <option value="">Tanlang...</option>
              {teachers
                .filter(t => t.id !== form.originalTeacherId)
                .map(t => (
                  <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                ))}
            </select>
          </div>

          {/* Sabab */}
          <div>
            <label className={LABEL}>Sabab *</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(REASON_META) as AbsenceReason[]).map(r => {
                const m = REASON_META[r];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, reason: r }))}
                    className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${
                      form.reason === r
                        ? 'bg-primary-600 text-white border-emerald-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <m.icon size={14} className="shrink-0" /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Izoh */}
          <div>
            <label className={LABEL}>Izoh (ixtiyoriy)</label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Qo'shimcha ma'lumot..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          {/* Maosh ma'lumoti */}
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700">
            ℹTayinlangach avtomatik hisoblanadi: o'rinbosar maoshi oshiriladi, asl o'qituvchidan chegirma qilinadi.
          </div>

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Bekor</button>
            <button
              onClick={handleSubmit}
              disabled={mut.isPending}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-50 transition-colors"
            >
              {mut.isPending ? 'Saqlanmoqda...' : 'Tayinlash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
