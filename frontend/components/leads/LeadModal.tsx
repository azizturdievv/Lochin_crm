'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { STAGE_META, SOURCE_META, STAGE_ORDER } from '@/types/leads';
import type { Lead, LeadStage, LeadSource } from '@/types/leads';

const schema = z.object({
  firstName:   z.string().min(2, "Ism kiritilishi shart"),
  lastName:    z.string().min(2, "Familiya kiritilishi shart"),
  phone:       z.string().min(9, "Telefon raqam noto'g'ri"),
  source:      z.enum(['instagram','telegram','call','website','whatsapp','walk_in']),
  subject:     z.string().optional(),
  age:         z.string().optional(),
  parentName:  z.string().optional(),
  parentPhone: z.string().optional(),
  assignedTo:  z.string().optional(),
  stage:       z.enum(['new','contacted','waiting','trial','enrolled','lost']),
});

type FormData = z.infer<typeof schema>;

interface Props {
  lead:    Lead | null;
  onClose: () => void;
}

export default function LeadModal({ lead, onClose }: Props) {
  const qc      = useQueryClient();
  const isEdit  = !!lead;
  const [noteText, setNoteText] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'notes'>('info');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: lead ? {
      firstName:   lead.firstName,
      lastName:    lead.lastName,
      phone:       lead.phone,
      source:      lead.source,
      subject:     lead.subject ?? '',
      age:         lead.age != null ? String(lead.age) : '',
      parentName:  lead.parentName ?? '',
      parentPhone: lead.parentPhone ?? '',
      assignedTo:  lead.assignedTo ?? '',
      stage:       lead.stage,
    } : {
      source: 'call',
      stage:  'new',
    },
  });

  useEffect(() => {
    if (lead) {
      reset({
        firstName:   lead.firstName,
        lastName:    lead.lastName,
        phone:       lead.phone,
        source:      lead.source,
        subject:     lead.subject ?? '',
        age:         lead.age != null ? String(lead.age) : '',
        parentName:  lead.parentName ?? '',
        parentPhone: lead.parentPhone ?? '',
        assignedTo:  lead.assignedTo ?? '',
        stage:       lead.stage,
      });
    }
  }, [lead]);

  const saveMut = useMutation({
    mutationFn: (data: FormData) =>
      isEdit
        ? api.patch(`/leads/${lead!.id}`, data)
        : api.post('/leads', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead-stats'] });
      onClose();
    },
  });

  const noteMut = useMutation({
    mutationFn: (text: string) =>
      api.post(`/leads/${lead!.id}/notes`, { text }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      setNoteText('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/leads/${lead!.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead-stats'] });
      onClose();
    },
  });

  function onSubmit(data: FormData) {
    saveMut.mutate(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Sarlavha */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {isEdit ? `${lead!.firstName} ${lead!.lastName}` : 'Yangi lid'}
            </h2>
            {isEdit && (
              <span className={`text-xs font-medium ${STAGE_META[lead!.stage].color}`}>
                {STAGE_META[lead!.stage].label}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">✕</button>
        </div>

        {/* Tablar (faqat tahrirlashda) */}
        {isEdit && (
          <div className="flex border-b border-gray-100 px-6">
            {(['info', 'notes'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'info' ? '📋 Ma\'lumot' : `💬 Izohlar (${lead!.notes?.length ?? 0})`}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'info' ? (
            <form id="lead-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Ism / Familiya */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Ism</label>
                  <input {...register('firstName')} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ism" />
                  {errors.firstName && <p className="text-red-500 text-[10px] mt-1">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Familiya</label>
                  <input {...register('lastName')} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Familiya" />
                  {errors.lastName && <p className="text-red-500 text-[10px] mt-1">{errors.lastName.message}</p>}
                </div>
              </div>

              {/* Telefon */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Telefon</label>
                <input {...register('phone')} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="+998901234567" />
                {errors.phone && <p className="text-red-500 text-[10px] mt-1">{errors.phone.message}</p>}
              </div>

              {/* Manba va Bosqich */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Manba</label>
                  <select {...register('source')} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                    {(Object.keys(SOURCE_META) as LeadSource[]).map(s => (
                      <option key={s} value={s}>{SOURCE_META[s].icon} {SOURCE_META[s].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Bosqich</label>
                  <select {...register('stage')} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                    {STAGE_ORDER.map(s => (
                      <option key={s} value={s}>{STAGE_META[s].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fan va Yosh */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Fan (ixtiyoriy)</label>
                  <input {...register('subject')} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ingliz tili" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Yosh (ixtiyoriy)</label>
                  <input {...register('age')} type="number" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="15" />
                </div>
              </div>

              {/* Ota-ona */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Ota-ona ismi</label>
                  <input {...register('parentName')} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ota-ona" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Ota-ona telefoni</label>
                  <input {...register('parentPhone')} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="+998" />
                </div>
              </div>
            </form>
          ) : (
            /* Izohlar tab */
            <div className="space-y-3">
              {(lead?.notes ?? []).length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">Izohlar yo'q</p>
              ) : (
                [...(lead?.notes ?? [])].reverse().map(n => (
                  <div key={n.id} className="bg-gray-50 rounded-2xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">
                        {n.author ? `${n.author.firstName} ${n.author.lastName}` : 'Xodim'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(n.createdAt).toLocaleDateString('uz-UZ', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.text}</p>
                  </div>
                ))
              )}

              {/* Yangi izoh */}
              <div className="flex gap-2 pt-2">
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Izoh qo'shish..."
                  rows={2}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
                <button
                  onClick={() => noteText.trim() && noteMut.mutate(noteText.trim())}
                  disabled={!noteText.trim() || noteMut.isPending}
                  className="w-10 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition-colors flex items-center justify-center text-lg"
                >
                  ➤
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tugmalar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 gap-3">
          {isEdit ? (
            <button
              onClick={() => confirm("O'chirishni tasdiqlaysizmi?") && deleteMut.mutate()}
              disabled={deleteMut.isPending}
              className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
            >
              🗑️ O'chirish
            </button>
          ) : <div />}

          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              Bekor
            </button>
            {activeTab === 'info' && (
              <button
                form="lead-form"
                type="submit"
                disabled={saveMut.isPending}
                className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 transition-colors"
              >
                {saveMut.isPending ? 'Saqlanmoqda...' : (isEdit ? 'Saqlash' : "Qo'shish")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
