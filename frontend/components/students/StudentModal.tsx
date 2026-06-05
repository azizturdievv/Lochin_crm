'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Student, CreateStudentForm, UpdateStudentForm } from '@/types/students';

// ─── TURLARI ──────────────────────────────────────────────────────────────────
interface GroupOption {
  id: string;
  name: string;
  subject: { id: string; name: string } | null;
  teacher: { firstName: string; lastName: string } | null;
  lessonTime: { start: string; end: string } | null;
  currentStudents: number;
  maxStudents: number;
}

// ─── KONSTANTALAR ─────────────────────────────────────────────────────────────
const REFERRAL_SOURCES = ['Instagram', 'Telegram', "Do'st", 'Walk-in', "Qo'ng'iroq", 'Boshqa'];
const GRADES = Array.from({ length: 11 }, (_, i) => i + 1);

const INPUT  = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition';
const LABEL  = 'block text-xs font-medium text-gray-600 mb-1';
const ERR    = 'text-red-500 text-xs mt-0.5';

// ─── XATO XABARI ──────────────────────────────────────────────────────────────
type ApiErr = { response?: { data?: { message?: string | string[] } } };
function getErrMsg(err: unknown): string {
  const msg = (err as ApiErr)?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? 'Xatolik yuz berdi';
}

// ─── PROPS ────────────────────────────────────────────────────────────────────
interface Props {
  open:    boolean;
  onClose: () => void;
  student?: Student | null;
}

// ─── YARATISH FORMASI DEFAULT ─────────────────────────────────────────────────
const EMPTY_CREATE: CreateStudentForm = {
  firstName: '', lastName: '', middleName: '',
  email: '', phone: '', password: '',
  birthDate: '', address: '',
  schoolName: '', schoolGrade: undefined,
  groupId: '', enrollmentDate: '',
  referralSource: '', referralPerson: '',
  notes: '',
  parents: [],
};

type Tab = 'main' | 'academic' | 'extra' | 'parents';

export default function StudentModal({ open, onClose, student }: Props) {
  const qc     = useQueryClient();
  const isEdit = !!student;
  const [tab, setTab]   = useState<Tab>('main');
  const [form, setForm] = useState<CreateStudentForm>({ ...EMPTY_CREATE });
  const [editForm, setEditForm] = useState<UpdateStudentForm>({});

  // Guruhlar ro'yxati (yaratishda)
  const { data: groups } = useQuery({
    queryKey: ['groups-for-student-modal'],
    queryFn: () =>
      api.get<{ data: GroupOption[] }>('/groups', { params: { isActive: 'true', limit: 100 } })
        .then(r => r.data.data),
    enabled: open && !isEdit,
  });

  // Tanlangan guruh ma'lumotlari
  const selectedGroup = groups?.find(g => g.id === form.groupId);

  // ─── MUTATSIYALAR ───────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (data: CreateStudentForm) =>
      api.post('/students', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['groups'] });
      onClose();
    },
  });

  const editMut = useMutation({
    mutationFn: (data: UpdateStudentForm) =>
      api.patch(`/students/${student!.id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['student', student!.id] });
      onClose();
    },
  });

  // ─── RESET ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      if (student) {
        setEditForm({
          firstName:   student.firstName,
          lastName:    student.lastName,
          middleName:  student.middleName ?? '',
          email:       student.email,
          phone:       student.phone ?? '',
          isActive:    student.isActive,
          address:     student.address ?? '',
          schoolName:  student.schoolName ?? '',
          schoolGrade: student.schoolGrade ?? undefined,
          notes:       student.notes ?? '',
        });
      } else {
        setForm({ ...EMPTY_CREATE, parents: [] });
      }
      setTab('main');
    }
  }, [open, student]);

  if (!open) return null;

  const TABS: { key: Tab; label: string }[] = isEdit
    ? [
        { key: 'main',     label: '👤 Asosiy' },
        { key: 'academic', label: '🏫 O\'quv' },
        { key: 'extra',    label: '📝 Qo\'shimcha' },
      ]
    : [
        { key: 'main',     label: '👤 Asosiy' },
        { key: 'academic', label: '🏫 O\'quv' },
        { key: 'extra',    label: '📝 Qo\'shimcha' },
        { key: 'parents',  label: '👪 Ota-ona' },
      ];

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? "O'quvchi tahrirlash" : "Yangi o'quvchi"}
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
            ✕
          </button>
        </div>

        {/* Tablar */}
        <div className="flex border-b border-gray-100 px-6 shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`py-3 px-1 mr-5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Kontent */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isEdit
            ? <EditContent
                form={editForm}
                setForm={setEditForm}
                tab={tab}
                mut={editMut}
                onClose={onClose}
              />
            : <CreateContent
                form={form}
                setForm={setForm}
                tab={tab}
                setTab={setTab}
                groups={groups}
                selectedGroup={selectedGroup}
                mut={createMut}
                onClose={onClose}
              />
          }
        </div>
      </div>
    </div>
  );
}

// ─── YARATISH KONTENTI ────────────────────────────────────────────────────────
function CreateContent({ form, setForm, tab, setTab, groups, selectedGroup, mut, onClose }: {
  form: CreateStudentForm;
  setForm: (f: CreateStudentForm) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  groups?: GroupOption[];
  selectedGroup?: GroupOption;
  mut: ReturnType<typeof useMutation<unknown, unknown, CreateStudentForm>>;
  onClose: () => void;
}) {
  const set = (key: keyof CreateStudentForm, val: unknown) =>
    setForm({ ...form, [key]: val });

  function handleSubmit() {
    if (!form.firstName.trim()) { setTab('main'); return; }
    if (!form.lastName.trim())  { setTab('main'); return; }
    if (!form.email.trim())     { setTab('main'); return; }
    if (!form.password)         { setTab('main'); return; }
    mut.mutate(form);
  }

  return (
    <div className="space-y-4">

      {/* ── TAB: ASOSIY ── */}
      {tab === 'main' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Familiya *</label>
              <input value={form.lastName} onChange={e => set('lastName', e.target.value)}
                className={INPUT} placeholder="Karimov" />
            </div>
            <div>
              <label className={LABEL}>Ism *</label>
              <input value={form.firstName} onChange={e => set('firstName', e.target.value)}
                className={INPUT} placeholder="Jasur" />
            </div>
          </div>
          <div>
            <label className={LABEL}>Otasining ismi</label>
            <input value={form.middleName ?? ''} onChange={e => set('middleName', e.target.value)}
              className={INPUT} placeholder="Ixtiyoriy" />
          </div>
          <div>
            <label className={LABEL}>Email *</label>
            <input value={form.email} onChange={e => set('email', e.target.value)}
              type="email" className={INPUT} placeholder="jasur@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Telefon</label>
              <input value={form.phone ?? ''} onChange={e => set('phone', e.target.value)}
                className={INPUT} placeholder="+998901234567" />
            </div>
            <div>
              <label className={LABEL}>Tug'ilgan sana</label>
              <input value={form.birthDate ?? ''} onChange={e => set('birthDate', e.target.value)}
                type="date" className={INPUT} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Parol *</label>
            <input value={form.password} onChange={e => set('password', e.target.value)}
              type="password" className={INPUT} placeholder="Kamida 8 belgi" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Bekor
            </button>
            <button type="button" onClick={() => setTab('academic')}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
              Keyingi →
            </button>
          </div>
        </>
      )}

      {/* ── TAB: O'QUV ── */}
      {tab === 'academic' && (
        <>
          {/* Guruh tanlash */}
          <div>
            <label className={LABEL}>Guruh (ixtiyoriy)</label>
            <select value={form.groupId ?? ''} onChange={e => set('groupId', e.target.value)}
              className={INPUT}>
              <option value="">Guruhsiz qo'shish</option>
              {groups?.map(g => (
                <option key={g.id} value={g.id}
                  disabled={g.currentStudents >= g.maxStudents}>
                  {g.name}
                  {g.currentStudents >= g.maxStudents ? ' (to\'liq)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Guruh ma'lumotlari */}
          {selectedGroup && (
            <div className="bg-emerald-50 rounded-xl p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Fan</span>
                <span className="font-medium text-gray-800">{selectedGroup.subject?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Ustoz</span>
                <span className="font-medium text-gray-800">
                  {selectedGroup.teacher
                    ? `${selectedGroup.teacher.lastName} ${selectedGroup.teacher.firstName}`
                    : <span className="text-gray-400">Belgilanmagan</span>}
                </span>
              </div>
              {selectedGroup.lessonTime && (
                <div className="flex justify-between">
                  <span className="text-gray-500 text-xs">Vaqt</span>
                  <span className="text-gray-800">{selectedGroup.lessonTime.start}–{selectedGroup.lessonTime.end}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">O'quvchilar</span>
                <span className="text-gray-800">{selectedGroup.currentStudents}/{selectedGroup.maxStudents}</span>
              </div>
            </div>
          )}

          {form.groupId && (
            <div>
              <label className={LABEL}>O'qishga kirgan sana</label>
              <input value={form.enrollmentDate ?? ''} onChange={e => set('enrollmentDate', e.target.value)}
                type="date" className={INPUT} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Maktab nomi</label>
              <input value={form.schoolName ?? ''} onChange={e => set('schoolName', e.target.value)}
                className={INPUT} placeholder="1-maktab" />
            </div>
            <div>
              <label className={LABEL}>Sinf (1-11)</label>
              <select value={form.schoolGrade ?? ''} onChange={e => set('schoolGrade', e.target.value ? Number(e.target.value) : undefined)}
                className={INPUT}>
                <option value="">Tanlang</option>
                {GRADES.map(g => <option key={g} value={g}>{g}-sinf</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setTab('main')}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              ← Orqaga
            </button>
            <button type="button" onClick={() => setTab('extra')}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
              Keyingi →
            </button>
          </div>
        </>
      )}

      {/* ── TAB: QO'SHIMCHA ── */}
      {tab === 'extra' && (
        <>
          <div>
            <label className={LABEL}>Yashash manzili</label>
            <input value={form.address ?? ''} onChange={e => set('address', e.target.value)}
              className={INPUT} placeholder="Toshkent, Chilonzor..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Kim orqali keldi</label>
              <select value={form.referralSource ?? ''} onChange={e => set('referralSource', e.target.value)}
                className={INPUT}>
                <option value="">Tanlang</option>
                {REFERRAL_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Tavsiyachi ismi</label>
              <input value={form.referralPerson ?? ''} onChange={e => set('referralPerson', e.target.value)}
                className={INPUT} placeholder="Akbar Rahimov" />
            </div>
          </div>

          <div>
            <label className={LABEL}>Izoh</label>
            <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)}
              className={`${INPUT} resize-none`} rows={3} placeholder="Qo'shimcha ma'lumot..." />
          </div>

          {mut.isError && (
            <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">
              {getErrMsg(mut.error)}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setTab('academic')}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              ← Orqaga
            </button>
            <button type="button" onClick={() => setTab('parents')}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
              Ota-ona →
            </button>
            <button type="button" onClick={handleSubmit} disabled={mut.isPending}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition">
              {mut.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </>
      )}

      {/* ── TAB: OTA-ONA ── */}
      {tab === 'parents' && (
        <ParentsTab
          parents={form.parents ?? []}
          onChange={p => set('parents', p)}
          onBack={() => setTab('extra')}
          onSave={handleSubmit}
          isPending={mut.isPending}
          error={mut.isError ? getErrMsg(mut.error) : ''}
        />
      )}
    </div>
  );
}

// ─── TAHRIRLASH KONTENTI ──────────────────────────────────────────────────────
function EditContent({ form, setForm, tab, mut, onClose }: {
  form: UpdateStudentForm;
  setForm: (f: UpdateStudentForm) => void;
  tab: Tab;
  mut: ReturnType<typeof useMutation<unknown, unknown, UpdateStudentForm>>;
  onClose: () => void;
}) {
  const set = (key: keyof UpdateStudentForm, val: unknown) =>
    setForm({ ...form, [key]: val });

  const Btns = () => (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onClose}
        className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
        Bekor
      </button>
      <button type="button" onClick={() => mut.mutate(form)} disabled={mut.isPending}
        className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition">
        {mut.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {tab === 'main' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Familiya</label>
              <input value={form.lastName ?? ''} onChange={e => set('lastName', e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Ism</label>
              <input value={form.firstName ?? ''} onChange={e => set('firstName', e.target.value)} className={INPUT} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Otasining ismi</label>
            <input value={form.middleName ?? ''} onChange={e => set('middleName', e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Email</label>
            <input value={form.email ?? ''} onChange={e => set('email', e.target.value)} type="email" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Telefon</label>
            <input value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} className={INPUT} placeholder="+998" />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="isActive" checked={form.isActive ?? true}
              onChange={e => set('isActive', e.target.checked)} className="w-4 h-4 accent-emerald-600" />
            <label htmlFor="isActive" className="text-sm text-gray-700">Faol o'quvchi</label>
          </div>
          {mut.isError && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{getErrMsg(mut.error)}</p>}
          <Btns />
        </>
      )}

      {tab === 'academic' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Maktab nomi</label>
              <input value={form.schoolName ?? ''} onChange={e => set('schoolName', e.target.value)} className={INPUT} placeholder="1-maktab" />
            </div>
            <div>
              <label className={LABEL}>Sinf (1-11)</label>
              <select value={form.schoolGrade ?? ''} onChange={e => set('schoolGrade', e.target.value ? Number(e.target.value) : undefined)} className={INPUT}>
                <option value="">Tanlang</option>
                {GRADES.map(g => <option key={g} value={g}>{g}-sinf</option>)}
              </select>
            </div>
          </div>
          {mut.isError && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{getErrMsg(mut.error)}</p>}
          <Btns />
        </>
      )}

      {tab === 'extra' && (
        <>
          <div>
            <label className={LABEL}>Yashash manzili</label>
            <input value={form.address ?? ''} onChange={e => set('address', e.target.value)} className={INPUT} placeholder="Toshkent..." />
          </div>
          <div>
            <label className={LABEL}>Izoh</label>
            <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)}
              className={`${INPUT} resize-none`} rows={3} />
          </div>
          {mut.isError && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{getErrMsg(mut.error)}</p>}
          <Btns />
        </>
      )}
    </div>
  );
}

// ─── OTA-ONA TAB ──────────────────────────────────────────────────────────────
interface Parent { fullName: string; phone: string; relation?: string; isPrimary?: boolean; }

function ParentsTab({ parents, onChange, onBack, onSave, isPending, error }: {
  parents: Parent[];
  onChange: (p: Parent[]) => void;
  onBack: () => void;
  onSave: () => void;
  isPending: boolean;
  error: string;
}) {
  const add = () => onChange([...parents, { fullName: '', phone: '', relation: '', isPrimary: parents.length === 0 }]);
  const remove = (i: number) => onChange(parents.filter((_, idx) => idx !== i));
  const upd = (i: number, key: keyof Parent, val: unknown) =>
    onChange(parents.map((p, idx) => idx === i ? { ...p, [key]: val } : p));

  return (
    <div className="space-y-4">
      {parents.map((p, i) => (
        <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">{i + 1}-ota-ona</p>
            <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
          </div>
          <div>
            <label className={LABEL}>To'liq ism *</label>
            <input value={p.fullName} onChange={e => upd(i, 'fullName', e.target.value)}
              className={INPUT} placeholder="Karimov Abdulloh" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Telefon *</label>
              <input value={p.phone} onChange={e => upd(i, 'phone', e.target.value)}
                className={INPUT} placeholder="+998" />
            </div>
            <div>
              <label className={LABEL}>Munosabat</label>
              <select value={p.relation ?? ''} onChange={e => upd(i, 'relation', e.target.value)} className={INPUT}>
                <option value="">Tanlang</option>
                <option value="father">Ota</option>
                <option value="mother">Ona</option>
                <option value="guardian">Vasiy</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={p.isPrimary ?? false}
              onChange={e => upd(i, 'isPrimary', e.target.checked)} className="accent-emerald-600" />
            Asosiy ota-ona
          </label>
        </div>
      ))}

      {parents.length < 2 && (
        <button type="button" onClick={add}
          className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl text-sm hover:border-emerald-400 hover:text-emerald-600 transition">
          + Ota-ona qo'shish
        </button>
      )}

      {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onBack}
          className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
          ← Orqaga
        </button>
        <button type="button" onClick={onSave} disabled={isPending}
          className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition">
          {isPending ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </div>
    </div>
  );
}
