'use client';

import { Briefcase, ChevronLeft, ChevronRight, KeyRound, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { STAFF_ROLE_META } from '@/types/staff';
import type { StaffMember, StaffRole, StaffResponse } from '@/types/staff';
import StaffModal        from '@/components/staff/StaffModal';
import ResetPasswordModal from '@/components/staff/ResetPasswordModal';
import { useDebounce }   from '@/hooks/useDebounce';

type RoleFilter = StaffRole | 'all';

const ROLE_FILTERS: Array<{ v: RoleFilter; label: string }> = [
  { v: 'all',     label: 'Barchasi' },
  { v: 'manager', label: 'Manager'  },
  { v: 'ustoz',   label: 'Ustoz'    },
];

function relTime(iso: string | null): string {
  if (!iso) return 'Hech qachon';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60)  return `${m} daq oldin`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} soat oldin`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d} kun oldin`;
  return new Date(iso).toLocaleDateString('uz-UZ', { day:'2-digit', month:'short' });
}

export default function StaffPage() {
  const user  = useAuthStore(s => s.user);
  const role  = user?.role ?? '';
  const qc    = useQueryClient();
  const isSA  = role === 'super_admin';

  const [search,      setSearch]      = useState('');
  const [roleFilter,  setRoleFilter]  = useState<RoleFilter>('all');
  const [activeFilter,setActiveFilter]= useState<'all' | 'active' | 'inactive'>('active');
  const [page,        setPage]        = useState(1);
  const [editStaff,   setEditStaff]   = useState<StaffMember | null | undefined>(undefined);
  const [resetStaff,  setResetStaff]  = useState<StaffMember | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery<StaffResponse>({
    queryKey: ['staff', debouncedSearch, roleFilter, activeFilter, page],
    queryFn:  () => api.get<StaffResponse>('/users', {
      params: {
        search:   debouncedSearch || undefined,
        role:     roleFilter !== 'all' ? roleFilter : undefined,
        isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
        page,
        limit: 20,
      },
    }).then(r => r.data),
  });

  const toggleMut = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/toggle-active`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });

  const staff     = data?.data ?? [];
  const total     = data?.total ?? 0;
  const totalPages= data?.totalPages ?? 1;

  const activeCount   = staff.filter(s => s.isActive).length;
  const inactiveCount = staff.filter(s => !s.isActive).length;
  const managerCount  = staff.filter(s => s.role === 'manager').length;
  const ustozCount    = staff.filter(s => s.role === 'ustoz').length;

  return (
    <div className="flex flex-col h-full">
      {/* ─── Sarlavha ──────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 bg-white border-b border-gray-100 shrink-0 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xl shrink-0"><Briefcase size={16} /></div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Xodimlar</h1>
              <p className="text-xs text-gray-400">{total} ta xodim</p>
            </div>
          </div>
          {isSA && (
            <button
              onClick={() => setEditStaff(null)}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              <Plus size={16} /> Yangi xodim
            </button>
          )}
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-2xl p-3 text-center">
            <div className="text-xl font-bold text-blue-700">{managerCount}</div>
            <div className="text-[10px] text-blue-600">Manager</div>
          </div>
          <div className="bg-sky-50 rounded-2xl p-3 text-center">
            <div className="text-xl font-bold text-sky-700">{ustozCount}</div>
            <div className="text-[10px] text-sky-600">Ustoz</div>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-3 text-center">
            <div className="text-xl font-bold text-emerald-700">{activeCount}</div>
            <div className="text-[10px] text-emerald-600">Faol</div>
          </div>
          <div className="bg-gray-100 rounded-2xl p-3 text-center">
            <div className="text-xl font-bold text-gray-600">{inactiveCount}</div>
            <div className="text-[10px] text-gray-500">Faol emas</div>
          </div>
        </div>

        {/* Filtr + qidiruv */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Qidiruv */}
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"><Search size={16} /></span>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Ism, email, telefon bo'yicha..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Rol filtri */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {ROLE_FILTERS.map(f => (
              <button
                key={f.v}
                onClick={() => { setRoleFilter(f.v); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  roleFilter === f.v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Holat filtri */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {[
              { v: 'active',   label: 'Faol'      },
              { v: 'all',      label: 'Barchasi'  },
              { v: 'inactive', label: 'Nofaol'    },
            ].map(f => (
              <button
                key={f.v}
                onClick={() => { setActiveFilter(f.v as typeof activeFilter); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activeFilter === f.v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Jadval ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
            <div className="text-5xl"><Briefcase size={16} /></div>
            <p className="text-sm font-medium text-gray-500">Xodimlar topilmadi</p>
            {isSA && (
              <button
                onClick={() => setEditStaff(null)}
                className="text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-xl transition-colors"
              >
                <Plus size={16} /> Birinchi xodimni qo'shish
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop jadval */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Xodim</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Rol</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden sm:table-cell">Telefon</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">Oxirgi kirish</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Holat</th>
                    {isSA && <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">Amallar</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {staff.map(s => {
                    const roleMeta = STAFF_ROLE_META[s.role];
                    return (
                      <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${!s.isActive ? 'opacity-60' : ''}`}>
                        {/* Ism */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 overflow-hidden shrink-0">
                              {s.avatarUrl
                                ? <img src={s.avatarUrl} alt="" className="w-full h-full object-cover" />
                                : `${s.firstName[0]}${s.lastName[0]}`}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate">
                                {s.firstName} {s.lastName}
                                {s.middleName && ` ${s.middleName}`}
                              </p>
                              <p className="text-xs text-gray-400 truncate">{s.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Rol */}
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleMeta.bg} ${roleMeta.color}`}>
                            {roleMeta.label}
                          </span>
                        </td>

                        {/* Telefon */}
                        <td className="px-4 py-3.5 text-xs text-gray-500 hidden sm:table-cell">
                          {s.phone ?? '—'}
                        </td>

                        {/* Oxirgi kirish */}
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <div className="text-xs text-gray-500">{relTime(s.lastLoginAt)}</div>
                          {s.twoFaEnabled && (
                            <div className="text-[10px] text-emerald-600 mt-0.5">2FA yoqilgan</div>
                          )}
                        </td>

                        {/* Holat */}
                        <td className="px-4 py-3.5">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            s.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {s.isActive ? 'Faol' : 'Nofaol'}
                          </span>
                        </td>

                        {/* Amallar */}
                        {isSA && (
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              {/* Tahrirlash */}
                              <button
                                onClick={() => setEditStaff(s)}
                                className="text-xs text-gray-500 hover:text-gray-700 w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
                                title="Tahrirlash"
                              ><Pencil size={16} /></button>

                              {/* Parol tiklash */}
                              <button
                                onClick={() => setResetStaff(s)}
                                className="text-xs text-gray-500 hover:text-amber-600 w-7 h-7 rounded-lg hover:bg-amber-50 flex items-center justify-center transition-colors"
                                title="Parol tiklash"
                              ><KeyRound size={16} /></button>

                              {/* Faollashtirish / o'chirish toggle */}
                              <button
                                onClick={() => toggleMut.mutate(s.id)}
                                disabled={toggleMut.isPending}
                                className={`text-xs w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                  s.isActive
                                    ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                                    : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={s.isActive ? "O'chirish" : 'Faollashtirish'}
                              >
                                {s.isActive ? '' : ''}
                              </button>

                              {/* Arxiv (soft delete) */}
                              <button
                                onClick={() => confirm(`${s.firstName} ni o'chirishni tasdiqlaysizmi?`) && deleteMut.mutate(s.id)}
                                disabled={deleteMut.isPending}
                                className="text-xs text-gray-400 hover:text-red-600 w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                                title="Arxivlash (soft delete)"
                              ><Trash2 size={16} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-gray-400">
                  {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} / {total}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    <ChevronLeft size={14} /> Oldingi
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = page <= 3 ? i + 1 : page - 2 + i;
                    if (p < 1 || p > totalPages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 text-xs rounded-xl transition-colors ${
                          page === p
                            ? 'bg-primary-600 text-white'
                            : 'border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Keyingi <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {editStaff !== undefined && (
        <StaffModal staff={editStaff} onClose={() => setEditStaff(undefined)} />
      )}
      {resetStaff && (
        <ResetPasswordModal staff={resetStaff} onClose={() => setResetStaff(null)} />
      )}
    </div>
  );
}
