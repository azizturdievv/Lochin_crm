'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { PermissionMatrixResponse, MatrixChange } from '@/types/permissions';
import { ROLE_LABELS, MODULE_LABELS } from '@/types/permissions';
import type { Role } from '@/types';

export default function PermissionsMatrixTab() {
  const qc = useQueryClient();
  const [dirty, setDirty] = useState<Map<string, boolean>>(new Map());
  const [msg, setMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['permissions-matrix'],
    queryFn:  () => api.get<PermissionMatrixResponse>('/permissions/matrix').then(r => r.data),
  });

  const saveMut = useMutation({
    mutationFn: (changes: MatrixChange[]) => api.patch('/permissions/matrix', { changes }),
    onSuccess: () => {
      setMsg('Ruxsatlar matritsasi saqlandi');
      setDirty(new Map());
      qc.invalidateQueries({ queryKey: ['permissions-matrix'] });
      setTimeout(() => setMsg(''), 3000);
    },
    onError: () => setMsg('Xatolik yuz berdi'),
  });

  const roles = data?.roles ?? [];

  function keyOf(role: Role, permissionId: string) {
    return `${role}:${permissionId}`;
  }

  function isChecked(role: Role, permissionId: string, original: boolean): boolean {
    const key = keyOf(role, permissionId);
    return dirty.has(key) ? dirty.get(key)! : original;
  }

  function toggle(role: Role, permissionId: string, current: boolean) {
    if (role === 'super_admin') return;
    const key = keyOf(role, permissionId);
    setDirty(prev => {
      const next = new Map(prev);
      next.set(key, !current);
      return next;
    });
  }

  const dirtyCount = dirty.size;

  function handleSave() {
    const changes: MatrixChange[] = [...dirty.entries()].map(([key, granted]) => {
      const [role, permissionId] = key.split(':') as [Role, string];
      return { role, permissionId, granted };
    });
    if (changes.length) saveMut.mutate(changes);
  }

  const moduleList = useMemo(() => data?.modules ?? [], [data]);

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Yuklanmoqda...</div>;
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">
          {msg}
        </div>
      )}

      {moduleList.map(mod => (
        <div key={mod.module} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[420px]">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/60">
                <h3 className="text-sm font-semibold text-gray-900 truncate min-w-0">
                  {MODULE_LABELS[mod.module] ?? mod.module}
                </h3>
                <div className="flex items-center gap-3 shrink-0">
                  {roles.map(r => (
                    <span key={r} className="w-11 text-center text-[10px] font-medium text-gray-400 truncate">
                      {ROLE_LABELS[r]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {mod.permissions.map(p => (
                  <div key={p.id} className="px-5 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{p.displayName}</p>
                      <p className="text-[10px] text-gray-400 font-mono truncate">{p.action}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {roles.map(r => {
                        const checked = isChecked(r, p.id, p.grants[r]);
                        return (
                          <span key={r} className="w-11 flex justify-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={r === 'super_admin'}
                              onChange={() => toggle(r, p.id, checked)}
                              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-primary-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={!dirtyCount || saveMut.isPending}
        className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
      >
        {saveMut.isPending ? 'Saqlanmoqda...' : dirtyCount ? `Saqlash (${dirtyCount})` : 'Saqlash'}
      </button>
    </div>
  );
}
