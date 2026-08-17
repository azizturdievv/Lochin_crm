'use client';

import { Archive, History, Lock, RotateCcw, Search, X } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { toast } from '@/store/toast.store';
import { formatDate, formatDateTime } from '@/lib/date';
import { useDebounce } from '@/hooks/useDebounce';
import type {
  ArchiveEntityType, ArchiveListResponse, ArchivedItem, ArchivedUserItem, ArchivedGroupItem,
  ArchivedDetail, ArchivedUserDetail, ArchivedGroupDetail, AuditLogResponse,
} from '@/types/archive';
import { ARCHIVE_TABS, ARCHIVE_TYPE_META, ACTION_LABELS } from '@/types/archive';

const DAYS_SHORT: Record<string, string> = {
  monday: 'Dushanba', tuesday: 'Seshanba', wednesday: 'Chorshanba',
  thursday: 'Payshanba', friday: 'Juma', saturday: 'Shanba', sunday: 'Yakshanba',
};

function isGroupItem(item: ArchivedItem): item is ArchivedGroupItem {
  return 'name' in item;
}

function isGroupDetail(item: ArchivedDetail): item is ArchivedGroupDetail {
  return 'name' in item;
}

const fetchArchiveList = (entityType: ArchiveEntityType, search: string, page: number) =>
  api.get<ArchiveListResponse>('/archive', {
    params: { entityType, ...(search && { search }), page, limit: 20 },
  }).then(r => r.data);

const fetchHistory = (entityType: ArchiveEntityType, entityId: string) =>
  api.get<AuditLogResponse>(`/archive/history/${entityType}/${entityId}`).then(r => r.data);

const fetchDetail = (entityType: ArchiveEntityType, id: string) =>
  api.get<ArchivedDetail>(`/archive/${entityType}/${id}`).then(r => r.data);

export default function ArchivePage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const role = user?.role ?? '';

  const [tab, setTab] = useState<ArchiveEntityType>('student');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [historyItem, setHistoryItem] = useState<{ id: string; label: string } | null>(null);
  const [restoreItem, setRestoreItem] = useState<{ id: string; label: string } | null>(null);
  const [detailItem, setDetailItem]   = useState<{ id: string; label: string } | null>(null);

  const dSearch = useDebounce(search, 350);

  // ── RBAC ───────────────────────────────────────────────────────────────────
  if (role !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <div className="text-5xl mb-3"><Lock size={16} /></div>
        <p className="font-medium text-gray-600">Bu sahifa faqat Super Admin uchun</p>
        <p className="text-sm mt-1">Sizga bu bo'limga kirish ruxsati yo'q</p>
      </div>
    );
  }

  const { data, isLoading } = useQuery({
    queryKey: ['archive', tab, dSearch, page],
    queryFn:  () => fetchArchiveList(tab, dSearch, page),
    placeholderData: prev => prev,
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => api.post(`/archive/${tab}/${id}/restore`).then(r => r.data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['archive'] });
      toast.success(res?.message ?? 'Tiklandi');
      setRestoreItem(null);
    },
    onError: () => toast.error('Tiklashda xatolik'),
  });

  const items    = data?.data ?? [];
  const total    = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  function itemLabel(item: ArchivedItem): string {
    return isGroupItem(item) ? item.name : `${item.lastName} ${item.firstName}`;
  }

  function switchTab(t: ArchiveEntityType) {
    setTab(t); setSearch(''); setPage(1);
  }

  return (
    <div className="space-y-5">

      {/* ── SARLAVHA ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Archive size={20} /> Arxiv
        </h2>
        <p className="text-gray-500 text-sm mt-0.5">
          O'chirilgan va nofaol qilingan yozuvlar — faqat Super Admin ko'radi va tiklay oladi
        </p>
      </div>

      {/* ── TABLAR ───────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {ARCHIVE_TABS.map(t => (
          <button key={t.value} onClick={() => switchTab(t.value)}
            className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors -mb-px ${
              tab === t.value
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── QIDIRUV ──────────────────────────────────────────────────── */}
      <div className="relative max-w-sm">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={16} /></span>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder={tab === 'group' ? 'Guruh nomi...' : 'Ism, familiya, telefon...'}
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* ── RO'YXAT ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {tab === 'group' ? 'Guruh' : 'Ism familiya'}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">
                  {tab === 'group' ? 'Fan / Ustoz' : 'Aloqa'}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Holati</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Arxivlangan sana</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3.5"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-gray-400">
                    <div className="text-5xl mb-3"><Archive size={16} /></div>
                    <p className="font-medium text-gray-500">Arxivda hech narsa yo'q</p>
                  </td>
                </tr>
              ) : items.map(item => {
                const group = isGroupItem(item);
                const meta = ARCHIVE_TYPE_META[item.archiveType];
                return (
                  <tr key={item.id}
                    onClick={() => setDetailItem({ id: item.id, label: itemLabel(item) })}
                    className="hover:bg-gray-50/60 transition-colors cursor-pointer">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-gray-900">{itemLabel(item)}</p>
                      {!group && (item as ArchivedUserItem).username && (
                        <p className="text-xs text-gray-400">@{(item as ArchivedUserItem).username}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell text-gray-600">
                      {group ? (
                        <>
                          <p>{(item as ArchivedGroupItem).subject?.name ?? '—'}</p>
                          {(item as ArchivedGroupItem).teacher && (
                            <p className="text-xs text-gray-400">
                              {(item as ArchivedGroupItem).teacher!.lastName} {(item as ArchivedGroupItem).teacher!.firstName}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <p>{(item as ArchivedUserItem).phone ?? '—'}</p>
                          {(item as ArchivedUserItem).email && <p className="text-xs text-gray-400">{(item as ArchivedUserItem).email}</p>}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell text-gray-500 text-xs">
                      {formatDateTime(item.archivedAt)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setHistoryItem({ id: item.id, label: itemLabel(item) }); }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                          title="Tarixni ko'rish"
                        ><History size={16} /></button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRestoreItem({ id: item.id, label: itemLabel(item) }); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 text-xs font-medium transition-colors"
                          title="Tiklash"
                        ><RotateCcw size={14} /> Tiklash</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">{total} ta yozuv</p>
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

      {/* ── TAFSILOT MODAL ───────────────────────────────────────────── */}
      {detailItem && (
        <DetailModal
          entityType={tab}
          id={detailItem.id}
          onClose={() => setDetailItem(null)}
          onHistory={() => { setHistoryItem(detailItem); setDetailItem(null); }}
          onRestore={() => { setRestoreItem(detailItem); setDetailItem(null); }}
        />
      )}

      {/* ── TARIX MODAL ──────────────────────────────────────────────── */}
      {historyItem && (
        <HistoryModal
          entityType={tab}
          entityId={historyItem.id}
          label={historyItem.label}
          onClose={() => setHistoryItem(null)}
        />
      )}

      {/* ── TIKLASH TASDIQLASH ───────────────────────────────────────── */}
      {restoreItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="text-3xl mb-3"><RotateCcw size={30} /></div>
            <h3 className="font-semibold text-gray-900 mb-1">"{restoreItem.label}" tiklansinmi?</h3>
            <p className="text-gray-500 text-sm mb-5">
              Yozuv qayta faol holatga qaytariladi va odatdagi ro'yxatlarda yana ko'rina boshlaydi.
              {tab === 'group' && ' Diqqat: bekor qilingan darslar avtomatik tiklanmaydi — kerak bo\'lsa Jadval bo\'limidan qayta generatsiya qiling.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setRestoreItem(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Bekor
              </button>
              <button onClick={() => restoreMut.mutate(restoreItem.id)} disabled={restoreMut.isPending}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium disabled:opacity-60 transition">
                {restoreMut.isPending ? 'Tiklanmoqda...' : 'Tiklash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAFSILOT MODAL ─────────────────────────────────────────────────────────
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

const USER_ROLE_LABELS: Record<string, string> = {
  student: "O'quvchi", ustoz: 'Ustoz', manager: 'Manager', super_admin: 'Super Admin',
};

function DetailModal({ entityType, id, onClose, onHistory, onRestore }: {
  entityType: ArchiveEntityType; id: string; onClose: () => void;
  onHistory: () => void; onRestore: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['archive-detail', entityType, id],
    queryFn:  () => fetchDetail(entityType, id),
  });

  const group = data && isGroupDetail(data);
  const meta = data ? ARCHIVE_TYPE_META[data.archiveType] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {isLoading ? '...' : group ? (data as ArchivedGroupDetail).name : `${(data as ArchivedUserDetail)?.lastName ?? ''} ${(data as ArchivedUserDetail)?.firstName ?? ''}`}
            </h3>
            {meta && <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${meta.cls}`}>{meta.label}</span>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 shrink-0"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : !data ? (
            <p className="text-center text-gray-400 text-sm py-8">Ma'lumot topilmadi</p>
          ) : group ? (
            <>
              <Section title="Asosiy">
                <Field label="Fan" value={(data as ArchivedGroupDetail).subject?.name} />
                <Field label="Xona" value={(data as ArchivedGroupDetail).roomNumber} />
                <Field label="Ustoz" value={(data as ArchivedGroupDetail).teacher ? `${(data as ArchivedGroupDetail).teacher!.lastName} ${(data as ArchivedGroupDetail).teacher!.firstName}` : null} />
                <Field label="Ustoz telefoni" value={(data as ArchivedGroupDetail).teacher?.phone} />
              </Section>
              <Section title="Jadval">
                <Field label="Dars kunlari" value={(data as ArchivedGroupDetail).lessonDays.map(d => DAYS_SHORT[d] ?? d).join(', ') || null} />
                <Field label="Dars vaqti" value={(data as ArchivedGroupDetail).lessonTime ? `${(data as ArchivedGroupDetail).lessonTime!.start}–${(data as ArchivedGroupDetail).lessonTime!.end}` : null} />
                <Field label="Dars soati" value={`${(data as ArchivedGroupDetail).lessonHours} soat`} />
              </Section>
              <Section title="Sig'im va narx">
                <Field label="O'quvchilar" value={`${(data as ArchivedGroupDetail).currentStudents} / ${(data as ArchivedGroupDetail).maxStudents}`} />
                <Field label="Oylik narx" value={(data as ArchivedGroupDetail).monthlyPrice > 0 ? `${(data as ArchivedGroupDetail).monthlyPrice.toLocaleString('uz-UZ')} so'm` : null} />
              </Section>
              <Section title="Muddat">
                <Field label="Boshlangan" value={(data as ArchivedGroupDetail).startedAt ? formatDate((data as ArchivedGroupDetail).startedAt!) : null} />
                <Field label="Tugagan" value={(data as ArchivedGroupDetail).endedAt ? formatDate((data as ArchivedGroupDetail).endedAt!) : null} />
                <Field label="Yaratilgan" value={formatDateTime((data as ArchivedGroupDetail).createdAt)} />
                <Field label="Arxivlangan" value={formatDateTime(data.archivedAt)} />
              </Section>
            </>
          ) : (
            <>
              <Section title="Aloqa">
                <Field label="Username" value={(data as ArchivedUserDetail).username ? `@${(data as ArchivedUserDetail).username}` : null} />
                <Field label="Rol" value={USER_ROLE_LABELS[(data as ArchivedUserDetail).role] ?? (data as ArchivedUserDetail).role} />
                <Field label="Telefon" value={(data as ArchivedUserDetail).phone} />
                <Field label="Email" value={(data as ArchivedUserDetail).email} />
                <Field label="Manzil" value={(data as ArchivedUserDetail).address} />
              </Section>
              {(entityType === 'student') && (
                <Section title="O'quv ma'lumoti">
                  <Field label="Maktab" value={(data as ArchivedUserDetail).schoolName} />
                  <Field label="Sinf" value={(data as ArchivedUserDetail).schoolGrade} />
                  <Field label="Tug'ilgan sana" value={(data as ArchivedUserDetail).birthDate ? formatDate((data as ArchivedUserDetail).birthDate!) : null} />
                  <Field label="Ball" value={(data as ArchivedUserDetail).totalPoints > 0 ? (data as ArchivedUserDetail).totalPoints : null} />
                  <Field label="Qayerdan bilgan" value={(data as ArchivedUserDetail).referralSource} />
                  <Field label="Kim orqali" value={(data as ArchivedUserDetail).referralPerson} />
                </Section>
              )}
              {(data as ArchivedUserDetail).notes && (
                <Section title="Izoh">
                  <div className="col-span-2"><p className="text-sm text-gray-700">{(data as ArchivedUserDetail).notes}</p></div>
                </Section>
              )}
              <Section title="Tizim">
                <Field label="Ro'yxatdan o'tgan" value={formatDateTime((data as ArchivedUserDetail).createdAt)} />
                <Field label="Oxirgi kirish" value={(data as ArchivedUserDetail).lastLoginAt ? formatDateTime((data as ArchivedUserDetail).lastLoginAt!) : 'Hech qachon'} />
                <Field label="Arxivlangan" value={formatDateTime(data.archivedAt)} />
              </Section>
            </>
          )}
        </div>

        {data && (
          <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
            <button onClick={onHistory}
              className="flex items-center justify-center gap-1.5 flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              <History size={14} /> Tarix
            </button>
            <button onClick={onRestore}
              className="flex items-center justify-center gap-1.5 flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition">
              <RotateCcw size={14} /> Tiklash
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TARIX MODAL ────────────────────────────────────────────────────────────
function HistoryModal({ entityType, entityId, label, onClose }: {
  entityType: ArchiveEntityType; entityId: string; label: string; onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['archive-history', entityType, entityId],
    queryFn:  () => fetchHistory(entityType, entityId),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Tarix</h3>
            <p className="text-xs text-gray-400">{label}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : !data?.data.length ? (
            <p className="text-center text-gray-400 text-sm py-8">Tarix topilmadi</p>
          ) : (
            <div className="space-y-3">
              {data.data.map(log => (
                <div key={log.id} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-primary-400 mt-1.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">{ACTION_LABELS[log.action] ?? log.action}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDateTime(log.createdAt)}{log.userEmail ? ` · ${log.userEmail}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
