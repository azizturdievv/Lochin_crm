'use client';

import { BarChart3, BookOpen, ChevronLeft, FileText, FolderOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { Subject } from '@/types/lms';
import { getSubjectVisual } from '@/types/lms';
import SubjectCard, { SubjectCardSkeleton } from '@/components/lms/SubjectCard';
import MaterialsTab from '@/components/lms/MaterialsTab';
import TestsTab     from '@/components/lms/TestsTab';
import HomeworkTab  from '@/components/lms/HomeworkTab';
import BaselineTab  from '@/components/lms/BaselineTab';

type Tab = 'materials' | 'tests' | 'homework' | 'baseline';

interface GroupOption {
  id:   string;
  name: string;
}

const TABS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: 'materials', label: 'Materiallar', icon: FolderOpen },
  { id: 'tests',     label: 'Testlar',     icon: FileText },
  { id: 'homework',  label: 'Vazifalar',   icon: BookOpen },
  { id: 'baseline',  label: 'Ilk qabul',  icon: BarChart3 },
];

// Ustoz: material yuklash + test draft
// Manager / SA: test tasdiqlash
// Student: test o'tish + vazifa topshirish

export default function LmsPage() {
  const user    = useAuthStore(s => s.user);
  const role    = user?.role ?? 'student';

  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [activeTab,     setActiveTab]     = useState<Tab>('materials');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const activeVisual = activeSubject ? getSubjectVisual(activeSubject) : null;
  const ActiveIcon   = activeVisual?.icon ?? null;

  // Fanlar ro'yxati
  const { data: subjects = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn:  () => api.get<Subject[]>('/subjects').then(r => r.data),
    staleTime: 5 * 60_000,
  });

  // Rol asosida huquqlar (backend: test/savol SA+Manager+Ustoz uchun ochiq)
  const canUpload   = role === 'ustoz' || role === 'super_admin' || role === 'manager';
  const canCreate   = role === 'ustoz' || role === 'super_admin' || role === 'manager';
  const canApprove  = role === 'super_admin' || role === 'manager';
  const isStudent   = role === 'student';
  const studentId   = isStudent ? (user?.id ?? null) : null;

  // Tanlangan fan bo'yicha guruhlar (o'quvchi — faqat o'zi qatnashadigan, boshqalar — barchasi)
  const { data: subjectGroups = [] } = useQuery({
    queryKey: ['lms-groups', activeSubject?.id],
    queryFn:  () => api.get<{ data: GroupOption[] }>('/groups', {
      params: { subjectId: activeSubject!.id, limit: 50 },
    }).then(r => r.data.data),
    enabled: !!activeSubject,
  });

  // Fan almashganda guruh tanlovini tozalash, so'ng birinchi guruhni avtomatik tanlash
  useEffect(() => { setActiveGroupId(null); }, [activeSubject?.id]);
  useEffect(() => {
    if (!activeGroupId && subjectGroups.length > 0) setActiveGroupId(subjectGroups[0].id);
  }, [subjectGroups, activeGroupId]);

  const groupId = activeGroupId;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-gray-50">
      {/* ─── Chap panel: fanlar ──────────────────────────────────────── */}
      <div className={`shrink-0 flex-col bg-white border-r border-gray-100 ${
        activeSubject ? 'hidden md:flex md:w-72' : 'flex w-full md:w-72'
      }`}>
        {/* Sarlavha */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center text-white shrink-0"><BookOpen size={16} /></div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">LMS</h1>
              <p className="text-xs text-gray-400">Ko'p fanli o'quv tizimi</p>
            </div>
          </div>
        </div>

        {/* Fanlar ro'yxati */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {subjectsLoading
            ? Array.from({ length: 8 }).map((_, i) => <SubjectCardSkeleton key={i} />)
            : subjects.map(s => (
                <SubjectCard
                  key={s.id}
                  subject={s}
                  active={activeSubject?.id === s.id}
                  onClick={sub => {
                    setActiveSubject(sub);
                    setActiveTab('materials');
                  }}
                />
              ))
          }
        </div>

        {/* Qo'shimcha ma'lumot */}
        {activeSubject && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ background: activeVisual!.color + '20' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${activeSubject.stats?.avgScore ?? 0}%`,
                  background: activeVisual!.color,
                }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              O'rtacha ball: {activeSubject.stats?.avgScore?.toFixed(0) ?? '—'}%
            </p>
          </div>
        )}
      </div>

      {/* ─── Asosiy content ──────────────────────────────────────────── */}
      <div className={`flex-col min-w-0 overflow-hidden ${
        activeSubject ? 'flex w-full md:flex-1' : 'hidden md:flex md:flex-1'
      }`}>
        {activeSubject ? (
          <>
            {/* Fan sarlavhasi */}
            <div className="px-4 md:px-6 py-4 bg-white border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3 md:gap-4">
                <button
                  onClick={() => setActiveSubject(null)}
                  className="md:hidden shrink-0 -ml-1 text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100"
                >
                  <ChevronLeft size={22} />
                </button>
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: activeVisual!.color + '20' }}
                >
                  {ActiveIcon && <ActiveIcon size={14} className="shrink-0" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-gray-900 truncate">{activeSubject.name}</h2>
                  {activeSubject.description && (
                    <p className="text-xs text-gray-400 truncate">{activeSubject.description}</p>
                  )}
                </div>

                {/* Guruh tanlash (bir nechta guruh bo'lsa) — desktopda shu qatorda */}
                {!isStudent && subjectGroups.length > 1 && (
                  <select
                    value={activeGroupId ?? ''}
                    onChange={e => setActiveGroupId(e.target.value || null)}
                    className="hidden md:block text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 shrink-0 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {subjectGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                )}

                {/* Statistika pills — faqat desktop, mobilda joy tor */}
                {activeSubject.stats && (
                  <div className="hidden md:flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {activeSubject.stats.materialsCount}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {activeSubject.stats.testsCount}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {activeSubject.stats.homeworkCount}
                    </span>
                  </div>
                )}
              </div>

              {/* Guruh tanlash — mobilda alohida qator (yuqoridagi qatorda joy tor) */}
              {!isStudent && subjectGroups.length > 1 && (
                <select
                  value={activeGroupId ?? ''}
                  onChange={e => setActiveGroupId(e.target.value || null)}
                  className="md:hidden mt-3 w-full text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {subjectGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              )}

              {/* Tab navigatsiya */}
              <div className="flex gap-1 mt-4 border-b border-gray-100 -mb-4">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-emerald-600 text-emerald-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span><tab.icon size={14} className="shrink-0" /></span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'materials' && (
                <MaterialsTab
                  groupId={groupId}
                  canUpload={canUpload}
                />
              )}
              {activeTab === 'tests' && (
                <TestsTab
                  subjectId={activeSubject.id}
                  groupId={groupId}
                  canCreate={canCreate}
                  canApprove={canApprove}
                />
              )}
              {activeTab === 'homework' && (
                <HomeworkTab
                  groupId={groupId}
                  canCreate={canCreate}
                  studentId={studentId}
                />
              )}
              {activeTab === 'baseline' && (
                <BaselineTab
                  subjectId={activeSubject.id}
                  studentId={studentId}
                />
              )}
            </div>
          </>
        ) : (
          /* Fan tanlanmagan holat */
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-5">
            <div className="w-24 h-24 rounded-3xl bg-gray-100 flex items-center justify-center text-5xl"><BookOpen size={16} /></div>
            <div className="text-center">
              <p className="text-base font-semibold text-gray-600">Fan tanlang</p>
              <p className="text-sm text-gray-400 mt-1">
                Chap paneldan fan tanlang va o'quv materiallarini ko'ring
              </p>
            </div>

            {/* Tez qo'shish tugmalari (ustoz uchun) */}
            {canUpload && subjects.length > 0 && (
              <div className="flex gap-3 mt-2">
                <div className="text-xs text-gray-400 text-center">
                  Birinchi fan tanlang, keyin material yuklash yoki test yaratish mumkin
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
