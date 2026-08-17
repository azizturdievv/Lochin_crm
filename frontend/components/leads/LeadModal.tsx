'use client';

import { Send, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/date';
import { STAGE_META, SOURCE_META } from '@/types/leads';
import type { Lead, LeadStage, LeadSource } from '@/types/leads';

interface ManagerOption { id: string; firstName: string; lastName: string; }
const fetchManagers = () =>
  api.get<{ data: ManagerOption[] }>('/users', { params: { role: 'manager', limit: 100 } }).then(r => r.data.data);

const schema = z.object({
  fullName:          z.string().min(2, "Ism-familiya kiritilishi shart"),
  phone:             z.string().min(9, "Telefon raqam noto'g'ri"),
  source:            z.enum(['instagram','telegram','phone','website','whatsapp','walkin','referral']),
  interestedSubject: z.string().optional(),
  assignedToId:      z.string().optional(),
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

  // Kanban ro'yxati notes'siz keladi — tahrirlashda to'liq ma'lumot (izohlar bilan) alohida olinadi
  const { data: detail } = useQuery({
    queryKey: ['lead', lead?.id],
    queryFn:  () => api.get<Lead>(`/leads/${lead!.id}`).then(r => r.data),
    enabled:  isEdit,
  });

  const notes = detail?.notes ?? lead?.notes ?? [];

  const { data: managers } = useQuery({
    queryKey: ['leads-manager-options'],
    queryFn:  fetchManagers,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: lead ? {
      fullName:          lead.fullName,
      phone:             lead.phone,
      source:            lead.source ?? 'phone',
      interestedSubject: lead.interestedSubject ?? '',
      assignedToId:      lead.assignedToId ?? '',
    } : {
      source: 'phone',
      assignedToId: '',
    },
  });

  useEffect(() => {
    if (lead) {
      reset({
        fullName:          lead.fullName,
        phone:             lead.phone,
        source:            lead.source ?? 'phone',
        interestedSubject: lead.interestedSubject ?? '',
        assignedToId:      lead.assignedToId ?? '',
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
      onClose();
    },
  });

  const noteMut = useMutation({
    mutationFn: (content: string) =>
      api.post(`/leads/${lead!.id}/notes`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead', lead?.id] });
      setNoteText('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/leads/${lead!.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
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
              {isEdit ? lead!.fullName : 'Yangi lid'}
            </h2>
            {isEdit && (
              <span className={`text-xs font-medium ${STAGE_META[lead!.stage].color}`}>
                {STAGE_META[lead!.stage].label}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"><X size={16} /></button>
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
                {tab === 'info' ? 'Ma\'lumot' : `Izohlar (${notes.length})`}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'info' ? (
            <form id="lead-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Ism-familiya */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Ism-familiya</label>
                <input {...register('fullName')} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Ism Familiya" />
                {errors.fullName && <p className="text-red-500 text-[10px] mt-1">{errors.fullName.message}</p>}
              </div>

              {/* Telefon */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Telefon</label>
                <input {...register('phone')} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="+998901234567" />
                {errors.phone && <p className="text-red-500 text-[10px] mt-1">{errors.phone.message}</p>}
              </div>

              {/* Manba va Fan */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Manba</label>
                  <select {...register('source')} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                    {(Object.keys(SOURCE_META) as LeadSource[]).map(s => (
                      <option key={s} value={s}>{SOURCE_META[s].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Fan (ixtiyoriy)</label>
                  <input {...register('interestedSubject')} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Ingliz tili" />
                </div>
              </div>

              {/* Mas'ul manager */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Mas'ul manager</label>
                <select {...register('assignedToId')} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                  <option value="">Tayinlanmagan</option>
                  {managers?.map(m => (
                    <option key={m.id} value={m.id}>{m.lastName} {m.firstName}</option>
                  ))}
                </select>
              </div>
            </form>
          ) : (
            /* Izohlar tab */
            <div className="space-y-3">
              {notes.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">Izohlar yo'q</p>
              ) : (
                [...notes].reverse().map(n => (
                  <div key={n.id} className="bg-gray-50 rounded-2xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">
                        {n.createdBy ? `${n.createdBy.firstName} ${n.createdBy.lastName}` : 'Xodim'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {formatDateTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.content}</p>
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
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
                <button
                  onClick={() => noteText.trim() && noteMut.mutate(noteText.trim())}
                  disabled={!noteText.trim() || noteMut.isPending}
                  className="w-10 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-40 transition-colors flex items-center justify-center text-lg"
                >
                  <Send size={14} />
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
              O'chirish
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
                className="px-5 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-50 transition-colors"
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
