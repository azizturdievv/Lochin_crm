'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { EVENT_TYPE_META } from '@/types/events';
import type { EventType } from '@/types/events';

interface Props {
  onClose: () => void;
}

const EVENT_TYPES: EventType[] = ['olympiad', 'sport', 'robotics', 'chess', 'running', 'cultural'];

export default function CreateEventModal({ onClose }: Props) {
  const qc = useQueryClient();

  const [title,       setTitle]       = useState('');
  const [type,        setType]        = useState<EventType>('olympiad');
  const [desc,        setDesc]        = useState('');
  const [eventDate,   setEventDate]   = useState('');
  const [location,    setLocation]    = useState('');
  const [maxPart,     setMaxPart]     = useState('');
  const [regDeadline, setRegDeadline] = useState('');
  const [hasFee,      setHasFee]      = useState(false);
  const [feeAmount,   setFeeAmount]   = useState('');
  const [isOnline,      setIsOnline]      = useState(false);
  const [questionCount, setQuestionCount] = useState('10');
  const [timeLimit,     setTimeLimit]     = useState('60');
  const [error,       setError]       = useState('');

  const mut = useMutation({
    mutationFn: () => api.post('/events', {
      title:                title.trim(),
      type,
      description:          desc.trim() || undefined,
      eventDate,
      location:             location.trim() || undefined,
      maxParticipants:      maxPart ? +maxPart : undefined,
      registrationDeadline: regDeadline || undefined,
      entryFee:             hasFee && feeAmount ? +feeAmount : undefined,
      isOnline,
      questionCount:        isOnline ? +questionCount : undefined,
      timeLimit:            isOnline ? +timeLimit : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      onClose();
    },
    onError: () => setError("Saqlashda xatolik yuz berdi"),
  });

  function handleSubmit() {
    setError('');
    if (!title.trim()) { setError("Sarlavha kiritilishi shart"); return; }
    if (!eventDate)    { setError("Tadbir sanasi kiritilishi shart"); return; }
    mut.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Sarlavha */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl z-10">
          <h2 className="text-base font-bold text-gray-900">Yangi tadbir</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Sarlavha */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Tadbir nomi *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Olimpiada, Sport musobaqasi..."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Tur */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Tadbir turi *</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map(t => {
                const m = EVENT_TYPE_META[t];
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${
                      type === t
                        ? `${m.bg.replace('bg-', 'bg-').replace('-50', '-100')} ${m.color} border-current`
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <m.icon size={14} className="shrink-0" /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sana va joy */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Tadbir sanasi *</label>
              <input
                type="datetime-local"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Ro'yxat muddati</label>
              <input
                type="datetime-local"
                value={regDeadline}
                onChange={e => setRegDeadline(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Joylashuv</label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Manzil yoki xona"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Maksimal ishtirokchi</label>
            <input
              type="number"
              value={maxPart}
              onChange={e => setMaxPart(e.target.value)}
              placeholder="Cheklanmagan"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* To'lov */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input type="checkbox" checked={hasFee} onChange={e => setHasFee(e.target.checked)}
                className="w-4 h-4 accent-primary-600" />
              <span className="text-sm text-gray-700">Ishtirok to'lovi bor</span>
            </label>
            {hasFee && (
              <input
                type="number"
                value={feeAmount}
                onChange={e => setFeeAmount(e.target.value)}
                placeholder="To'lov miqdori (so'm)"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            )}
          </div>

          {/* Onlayn musobaqa */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input type="checkbox" checked={isOnline} onChange={e => setIsOnline(e.target.checked)}
                className="w-4 h-4 accent-primary-600" />
              <span className="text-sm text-gray-700">Onlayn musobaqa (test-savol asosida)</span>
            </label>
            {isOnline && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Savollar soni</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={questionCount}
                    onChange={e => setQuestionCount(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Vaqt chegarasi (daqiqa)</label>
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={timeLimit}
                    onChange={e => setTimeLimit(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tavsif */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Tavsif</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
              placeholder="Tadbir haqida qisqacha ma'lumot..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Bekor</button>
          <button
            onClick={handleSubmit}
            disabled={mut.isPending}
            className="px-5 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-50 transition-colors"
          >
            {mut.isPending ? 'Saqlanmoqda...' : '+ Yaratish'}
          </button>
        </div>
      </div>
    </div>
  );
}
