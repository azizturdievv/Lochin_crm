'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import StudentModal from '@/components/students/StudentModal';
import EnrollModal from '@/components/students/EnrollModal';
import type { StudentsResponse, Student } from '@/types/students';

interface Subject { id: string; name: string; }
interface GroupOption { id: string; name: string; teacher: { firstName: string; lastName: string } | null; }

// ─── API ──────────────────────────────────────────────────────────────────────
function fetchStudents(params: Record<string, unknown>) {
  return api.get<StudentsResponse>('/students', { params }).then(r => r.data);
}
function fetchGroups() {
  return api.get<{ data: GroupOption[] }>('/groups', { params: { isActive: 'true', limit: 100 } }).then(r => r.data.data);
}
function fetchSubjects() {
  return api.get<Subject[]>('/subjects').then(r => r.data);
}

// ─── HOLATLAR ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  active:   { label: 'Faol',      cls: 'bg-emerald-100 text-emerald-700' },
  inactive: { label: 'Arxivlangan', cls: 'bg-gray-100 text-gray-500'    },
};

const ROWS_PER_PAGE = 20;

// ─── ASOSIY SAHIFA ────────────────────────────────────────────────────────────
export default function StudentsPage() {
  const qc = useQueryClient();

  const [search,   setSearch]   = useState('');
  const [isActive, setIsActive] = useState<boolean | undefined>(true);
  const [hasDebt,  setHasDebt]  = useState<boolean | undefined>(undefined);
  const [page,     setPage]     = useState(1);
  const [modal,    setModal]    = useState<{ open: boolean; student: Student | null }>({ open: false, student: null });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [enrollId, setEnrollId] = useState<{ id: string; name: string } | null>(null);
  const [sortBy,   setSortBy]   = useState('createdAt');
  const [sortOrder,setSortOrder]= useState<'ASC'|'DESC'>('DESC');
  const [groupId,  setGroupId]  = useState('');

  const debouncedSearch = useDebounce(search, 400);

  const queryParams = {
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(isActive !== undefined && { isActive }),
    ...(hasDebt !== undefined && { hasDebt }),
    ...(groupId && { groupId }),
    page,
    limit: ROWS_PER_PAGE,
    sortBy,
    sortOrder,
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['students', queryParams],
    queryFn:  () => fetchStudents(queryParams),
    placeholderData: (prev) => prev,
  });

  // Guruhlar dropdown uchun
  const { data: groups } = useQuery({
    queryKey: ['groups-filter'],
    queryFn: fetchGroups,
  });

  // Tanlangan guruhning ustozi
  const selectedGroup = groups?.find((g: GroupOption) => g.id === groupId);
  const selectedTeacher = selectedGroup?.teacher;

  // O'chirish / arxivlash
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/students/${id}`).then(r => r.data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      setDeleteId(null);
    },
  });

  const handleSort = useCallback((field: string) => {
    if (sortBy === field) {
      setSortOrder(p => p === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
    setPage(1);
  }, [sortBy]);

  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const students   = data?.data       ?? [];

  return (
    <div className="space-y-5">

      {/* ── SARLAVHA ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">O'quvchilar</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Jami: <span className="font-medium text-gray-700">{total}</span> ta
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, student: null })}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
        >
          <span>+</span> Yangi o'quvchi
        </button>
      </div>

      {/* ── FILTER VA QIDIRUV ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          {/* Qidiruv */}
          <div className="relative flex-1 min-w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Ism, email yoki telefon..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Holat filter */}
          <select
            value={isActive === undefined ? '' : String(isActive)}
            onChange={e => {
              setIsActive(e.target.value === '' ? undefined : e.target.value === 'true');
              setPage(1);
            }}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white min-w-32"
          >
            <option value="true">Faol</option>
            <option value="false">Arxivlangan</option>
            <option value="">Barchasi</option>
          </select>

          {/* Qarz filter */}
          <select
            value={hasDebt === undefined ? '' : String(hasDebt)}
            onChange={e => {
              setHasDebt(e.target.value === '' ? undefined : e.target.value === 'true');
              setPage(1);
            }}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white min-w-32"
          >
            <option value="">To'lov holati</option>
            <option value="true">Qarzdor</option>
            <option value="false">Qarsiz</option>
          </select>

          {/* Guruh filter */}
          <select
            value={groupId}
            onChange={e => { setGroupId(e.target.value); setPage(1); }}
            className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white min-w-36"
          >
            <option value="">Barcha guruhlar</option>
            {groups?.map((g: GroupOption) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          {/* Tozalash */}
          {(search || hasDebt !== undefined || isActive !== true || groupId) && (
            <button
              onClick={() => { setSearch(''); setIsActive(true); setHasDebt(undefined); setGroupId(''); setPage(1); }}
              className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
            >
              ✕ Tozalash
            </button>
          )}
        </div>
      </div>

      {/* ── TANLANGAN GURUH USTOZI ──────────────────────────────────── */}
      {selectedGroup && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-blue-500 text-lg">🏫</span>
          <div>
            <p className="text-sm font-medium text-blue-800">{selectedGroup.name}</p>
            <p className="text-xs text-blue-600">
              Ustoz: {selectedTeacher
                ? `${selectedTeacher.lastName} ${selectedTeacher.firstName}`
                : 'Belgilanmagan'}
            </p>
          </div>
        </div>
      )}

      {/* ── JADVAL ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <SortTh label="O'quvchi"   field="firstName" current={sortBy} order={sortOrder} onSort={handleSort} />
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Telefon</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Guruhlar</th>
                <SortTh label="Ball"        field="totalPoints" current={sortBy} order={sortOrder} onSort={handleSort} />
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Holat</th>
                <SortTh label="Sana"        field="createdAt"   current={sortBy} order={sortOrder} onSort={handleSort} extraCls="hidden lg:table-cell" />
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Amal</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <div className="text-4xl mb-2">⚠️</div>
                    <p>Ma'lumot yuklanmadi. Qayta urinib ko'ring.</p>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-400">
                    <div className="text-5xl mb-3">👥</div>
                    <p className="font-medium text-gray-500">O'quvchi topilmadi</p>
                    <p className="text-sm mt-1">Qidiruv yoki filtrlarni o'zgartiring</p>
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <StudentRow
                    key={s.id}
                    student={s}
                    onEdit={() => setModal({ open: true, student: s })}
                    onDelete={() => setDeleteId(s.id)}
                    onEnroll={() => setEnrollId({ id: s.id, name: `${s.lastName} ${s.firstName}` })}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              {(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, total)} / {total}
            </p>
            <div className="flex items-center gap-1">
              <PageBtn disabled={page === 1} onClick={() => setPage(1)} label="«" />
              <PageBtn disabled={page === 1} onClick={() => setPage(p => p - 1)} label="‹" />
              {getPageNumbers(page, totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-xs">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(Number(p))}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      p === page
                        ? 'bg-emerald-600 text-white'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
              <PageBtn disabled={page === totalPages} onClick={() => setPage(p => p + 1)} label="›" />
              <PageBtn disabled={page === totalPages} onClick={() => setPage(totalPages)} label="»" />
            </div>
          </div>
        )}
      </div>

      {/* ── MODALAR ──────────────────────────────────────────────────── */}
      {enrollId && (
        <EnrollModal
          studentId={enrollId.id}
          studentName={enrollId.name}
          onClose={() => setEnrollId(null)}
        />
      )}

      <StudentModal
        open={modal.open}
        student={modal.student}
        onClose={() => setModal({ open: false, student: null })}
      />

      {/* O'chirish tasdiqlash */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="text-3xl mb-3">⚠️</div>
            <h3 className="font-semibold text-gray-900 mb-1">O'quvchini arxivlash</h3>
            <p className="text-gray-500 text-sm mb-5">
              O'quvchi arxivlanadi. Ma'lumotlar saqlanib qoladi.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Bekor
              </button>
              <button
                onClick={() => deleteMut.mutate(deleteId!)}
                disabled={deleteMut.isPending}
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

// ─── SATR KOMPONENTI ──────────────────────────────────────────────────────────
function StudentRow({ student, onEdit, onDelete, onEnroll }: {
  student: Student; onEdit: () => void; onDelete: () => void; onEnroll: () => void;
}) {
  const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
  const statusKey = student.isActive ? 'active' : 'inactive';
  const status    = STATUS_CONFIG[statusKey];

  return (
    <tr className="hover:bg-gray-50/60 transition-colors group">
      {/* Ism */}
      <td className="px-4 py-3.5">
        <Link href={`/dashboard/students/${student.id}`} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <span className="text-emerald-700 text-xs font-bold">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 hover:text-emerald-600 transition-colors truncate">
              {student.lastName} {student.firstName}
            </p>
            <p className="text-gray-400 text-xs truncate">
              {student.username ? `@${student.username}` : student.email ?? '—'}
            </p>
          </div>
        </Link>
      </td>

      {/* Telefon */}
      <td className="px-4 py-3.5 text-gray-600 text-sm">
        {student.phone ?? <span className="text-gray-300">—</span>}
      </td>

      {/* Guruhlar (placeholder) */}
      <td className="px-4 py-3.5 hidden md:table-cell">
        <span className="text-gray-400 text-xs">—</span>
      </td>

      {/* Ball */}
      <td className="px-4 py-3.5">
        <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600">
          ⭐ {student.totalPoints}
        </span>
      </td>

      {/* Holat */}
      <td className="px-4 py-3.5">
        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${status.cls}`}>
          {status.label}
        </span>
      </td>

      {/* Sana */}
      <td className="px-4 py-3.5 text-gray-400 text-xs hidden lg:table-cell">
        {new Date(student.createdAt).toLocaleDateString('uz-UZ')}
      </td>

      {/* Amallar */}
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link href={`/dashboard/students/${student.id}`}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors text-sm" title="Ko'rish">
            👁
          </Link>
          <button onClick={onEnroll}
            className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500 transition-colors text-sm" title="Guruhga yozish">
            📋
          </button>
          <button onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 transition-colors text-sm" title="Tahrirlash">
            ✏️
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors text-sm" title="Arxivlash">
            🗃️
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── YORDAMCHI KOMPONENTLAR ───────────────────────────────────────────────────
function SortTh({ label, field, current, order, onSort, extraCls = '' }: {
  label: string; field: string; current: string; order: string;
  onSort: (f: string) => void; extraCls?: string;
}) {
  const active = current === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={`text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 ${extraCls}`}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
          {active ? (order === 'ASC' ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  );
}

function PageBtn({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-8 h-8 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
      {label}
    </button>
  );
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
