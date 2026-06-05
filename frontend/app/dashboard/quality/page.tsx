'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import SpellingTab  from '@/components/quality/SpellingTab';
import ProgressTab  from '@/components/quality/ProgressTab';

// ─── Rol bo'yicha view ────────────────────────────────────────────────────────
// super_admin:  barcha xodim imlo + barcha o'quvchi o'sishi
// manager:      o'z imlo xatolari + guruhlardagi o'quvchilar
// ustoz:        o'z imlo + o'z guruhi o'quvchilari
// student:      o'z imlo xatolari + o'z o'sishi
// ota-ona uchun student view (farzand ID bilan)

type Tab = 'spelling' | 'progress';

interface Student {
  id:        string;
  firstName: string;
  lastName:  string;
  group?:    string;
}

interface StaffMember {
  id:        string;
  firstName: string;
  lastName:  string;
  role:      string;
}

export default function QualityPage() {
  const user = useAuthStore(s => s.user);
  const role = user?.role ?? 'student';

  const [tab,        setTab]        = useState<Tab>('spelling');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedStaff,   setSelectedStaff]   = useState<StaffMember | null>(null);

  const isSA      = role === 'super_admin';
  const isManager = role === 'manager';
  const isUstoz   = role === 'ustoz';
  const isStudent = role === 'student';

  const showStudentList  = isSA || isManager || isUstoz;
  const showStaffSpelling = isSA;

  // O'quvchilar ro'yxati (SA/Manager/Ustoz uchun)
  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['quality-students'],
    queryFn:  () => api.get<Student[]>('/students', { params: { limit: 100, isActive: true } })
      .then(r => (r.data as unknown as { data: Student[] }).data),
    enabled: showStudentList,
  });

  // Xodimlar ro'yxati (faqat SA)
  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ['quality-staff'],
    queryFn:  () => api.get<StaffMember[]>('/staff').then(r => r.data),
    enabled: showStaffSpelling,
  });

  // Aktiv userId
  const spellUserId   = showStaffSpelling && selectedStaff
    ? selectedStaff.id
    : isStudent
    ? user?.id
    : undefined; // showAll mode

  const progressUserId = selectedStudent?.id ?? (isStudent ? user?.id : undefined);
  const progressName   = selectedStudent
    ? `${selectedStudent.firstName} ${selectedStudent.lastName}`
    : isStudent
    ? `${user?.firstName} ${user?.lastName}`
    : undefined;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-gray-50">
      {/* ─── Chap panel (SA/Manager/Ustoz uchun filtr) ──────────── */}
      {(showStudentList || showStaffSpelling) && (
        <div className="w-64 shrink-0 bg-white border-r border-gray-100 flex flex-col">
          <div className="px-4 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">🔍 Sifat nazorati</h2>
            <p className="text-xs text-gray-400 mt-0.5">Foydalanuvchi tanlang</p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
            {/* O'quvchilar */}
            {showStudentList && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase px-1 mb-2">
                  O'quvchilar ({students.length})
                </p>
                <div className="space-y-0.5">
                  {students.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedStudent(selectedStudent?.id === s.id ? null : s);
                        setSelectedStaff(null);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                        selectedStudent?.id === s.id
                          ? 'bg-emerald-50 text-emerald-800 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-600 shrink-0">
                        {s.firstName[0]}{s.lastName[0]}
                      </div>
                      <span className="truncate">{s.firstName} {s.lastName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Xodimlar (faqat SA) */}
            {showStaffSpelling && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase px-1 mb-2">
                  Xodimlar ({staff.length})
                </p>
                <div className="space-y-0.5">
                  {staff.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedStaff(selectedStaff?.id === m.id ? null : m);
                        setSelectedStudent(null);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                        selectedStaff?.id === m.id
                          ? 'bg-purple-50 text-purple-800 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-[9px] font-bold text-purple-600 shrink-0">
                        {m.firstName[0]}{m.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <span className="truncate block">{m.firstName} {m.lastName}</span>
                        <span className="text-[9px] text-gray-400">{m.role}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Asosiy content ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Sarlavha */}
        <div className="px-6 py-4 bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-xl shrink-0">
              🔍
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900">
                {selectedStudent
                  ? `${selectedStudent.firstName} ${selectedStudent.lastName}`
                  : selectedStaff
                  ? `${selectedStaff.firstName} ${selectedStaff.lastName}`
                  : isStudent
                  ? "Mening sifatim"
                  : "Umumiy sifat nazorati"}
              </h1>
              <p className="text-xs text-gray-400">
                {isStudent
                  ? 'O\'z imlo xatolari va o\'sish grafigi'
                  : selectedStudent
                  ? "O'quvchi tahlili"
                  : selectedStaff
                  ? 'Xodim imlo tahlili'
                  : 'Foydalanuvchi tanlang yoki umumiy ko\'rinish'}
              </p>
            </div>
          </div>

          {/* Tab navigatsiya */}
          <div className="flex gap-1">
            {[
              { id: 'spelling',  label: 'Imlo xatolari',  icon: '✍️', show: true },
              { id: 'progress',  label: 'O\'sish grafigi', icon: '📈', show: !selectedStaff },
            ].filter(t => t.show).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as Tab)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'spelling' && (
            <SpellingTab
              userId={spellUserId}
              showAll={isSA && !selectedStaff && !selectedStudent}
            />
          )}
          {tab === 'progress' && !selectedStaff && (
            <ProgressTab
              userId={progressUserId}
              userName={progressName}
            />
          )}
        </div>
      </div>
    </div>
  );
}
