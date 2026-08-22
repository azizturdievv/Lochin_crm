'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { LIVE_SESSION_TYPE_META } from '@/types/live-sessions';
import type { LiveSession, LiveSessionType } from '@/types/live-sessions';

interface Props {
  session?: LiveSession;   // berilsa — tahrirlash rejimi (PATCH), aks holda yangi sessiya (POST)
  onClose:  () => void;
}

interface GroupOption { id: string; name: string; }

const TYPES = Object.keys(LIVE_SESSION_TYPE_META) as LiveSessionType[];

// Mahalliy sana+vaqt qatori (datetime-local) — toISOString() UTC+5'da vaqtni siljitib yuboradi
function toLocalDateTimeStr(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${mi}`;
}

function defaultScheduledAt(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return toLocalDateTimeStr(d);
}

export default function ScheduleLiveSessionModal({ session, onClose }: Props) {
  const qc = useQueryClient();
  const isEdit = !!session;

  const { data: groups = [] } = useQuery({
    queryKey: ['live-session-groups'],
    queryFn:  () => api.get<{ data: GroupOption[] }>('/groups', { params: { limit: 100 } }).then(r => r.data.data),
    enabled:  !isEdit,
  });

  const [title,           setTitle]           = useState(session?.title ?? '');
  const [type,             setType]            = useState<LiveSessionType>(session?.type ?? 'teacher_student');
  const [groupId,          setGroupId]         = useState(session?.groupId ?? '');
  const [scheduledAt,      setScheduledAt]     = useState(
    session ? toLocalDateTimeStr(new Date(session.scheduledAt)) : defaultScheduledAt(),
  );
  const [maxParticipants,  setMaxParticipants] = useState(session ? String(session.maxParticipants) : '');
  const [recordingEnabled, setRecordingEnabled] = useState(session?.recordingEnabled ?? false);
  const [error,            setError]           = useState('');

  const saveMut = useMutation({
    mutationFn: () => {
      const maxP = maxParticipants.trim() ? Number(maxParticipants) : undefined;
      if (isEdit && session) {
        return api.patch(`/live-sessions/${session.id}`, {
          title: title.trim(),
          type,
          scheduledAt: new Date(scheduledAt).toISOString(),
          maxParticipants: maxP,
          recordingEnabled,
        });
      }
      return api.post('/live-sessions', {
        title: title.trim(),
        type,
        groupId: groupId || undefined,
        scheduledAt: new Date(scheduledAt).toISOString(),
        maxParticipants: maxP,
        recordingEnabled,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['live-sessions'] });
      onClose();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e.response?.data?.message ?? 'Saqlashda xatolik yuz berdi'),
  });

  function handleSubmit() {
    setError('');
    if (!title.trim())  { setError('Sarlavha kiritilishi shart'); return; }
    if (!isEdit && type === 'teacher_student' && !groupId) { setError('Guruh tanlang'); return; }
    if (!scheduledAt)    { setError('Sana va vaqt kiritilishi shart'); return; }
    saveMut.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{isEdit ? 'Darsni tahrirlash' : 'Yangi onlayn dars'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"><X size={16} /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Tur</label>
            <div className="grid grid-cols-2 gap-1.5">
              {TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`text-xs px-2.5 py-2 rounded-lg font-medium transition-colors text-left ${
                    type === t
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {LIVE_SESSION_TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>

          {isEdit ? (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Guruh</label>
              <div className="text-sm px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-500">
                {session?.group?.name ?? 'Guruhsiz (umumiy)'}
                <span className="text-xs text-gray-400 ml-2">(o'zgartirib bo'lmaydi)</span>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Guruh{type === 'teacher_student' ? ' *' : ' (ixtiyoriy)'}
              </label>
              {groups.length === 0 ? (
                <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">
                  Sizga biriktirilgan guruh topilmadi
                </p>
              ) : (
                <select
                  value={groupId}
                  onChange={e => setGroupId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">{type === 'teacher_student' ? 'Tanlang...' : 'Guruhsiz (umumiy)'}</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Sarlavha *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Masalan: Ingliz tili — Unit 5"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Sana va vaqt *</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Ishtirokchilar chegarasi (ixtiyoriy)</label>
            <input
              type="number"
              min={2}
              max={1000}
              value={maxParticipants}
              onChange={e => setMaxParticipants(e.target.value)}
              placeholder="Xona turiga qarab avtomatik"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <label className="flex items-start gap-2 px-1 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={recordingEnabled}
              onChange={e => setRecordingEnabled(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-xs text-gray-700">
              Yozib olish
              <span className="block text-[10px] text-gray-400">Afzallik sifatida saqlanadi — video fayl hali avtomatik saqlanmaydi</span>
            </span>
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Bekor</button>
          <button
            onClick={handleSubmit}
            disabled={saveMut.isPending || (!isEdit && type === 'teacher_student' && groups.length === 0)}
            className="px-5 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-50 transition-colors"
          >
            {saveMut.isPending ? 'Saqlanmoqda...' : isEdit ? 'Saqlash' : 'Rejalashtirish'}
          </button>
        </div>
      </div>
    </div>
  );
}
