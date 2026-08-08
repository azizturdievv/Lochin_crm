'use client';

import { Search, X, Send } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Student } from '@/types/students';

interface Props {
  open:    boolean;
  onClose: () => void;
}

type Target = 'one' | 'all';

export default function SendNotificationModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [target,    setTarget]    = useState<Target>('one');
  const [q,         setQ]         = useState('');
  const [results,   setResults]   = useState<Student[]>([]);
  const [selected,  setSelected]  = useState<Student | null>(null);
  const [searching, setSearching] = useState(false);
  const [title,     setTitle]     = useState('');
  const [body,      setBody]      = useState('');
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ochilganda holatni tozalash
  useEffect(() => {
    if (open) {
      setTarget('one'); setQ(''); setResults([]); setSelected(null);
      setTitle(''); setBody(''); setError(''); setSuccess('');
    }
  }, [open]);

  // Debounce qidiruv — faqat o'quvchilar (/students allaqachon shu rolga cheklangan)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim() || q.trim().length < 2) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get<{ data: Student[] }>(`/students?search=${encodeURIComponent(q.trim())}&limit=10`);
        setResults(res.data.data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  const sendMut = useMutation({
    mutationFn: () => api.post('/notifications/send', {
      type:  'announcement',
      title: title.trim(),
      body:  body.trim(),
      ...(target === 'one' ? { userIds: [selected!.id] } : { targetRole: 'student' }),
    }),
    onSuccess: () => {
      setSuccess(target === 'one' ? 'Bildirishnoma yuborildi' : "Barcha o'quvchilarga yuborildi");
      qc.invalidateQueries({ queryKey: ['notifications'] });
      setTimeout(() => { setSuccess(''); onClose(); }, 1200);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setError(err?.response?.data?.message ?? 'Yuborishda xatolik');
      setTimeout(() => setError(''), 3000);
    },
  });

  if (!open) return null;

  const canSend = title.trim().length > 0 && body.trim().length > 0 && (target === 'all' || !!selected);

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Sarlavha */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Yangi bildirishnoma</h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition"
          ><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Kimga */}
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-xl">
            <button
              onClick={() => setTarget('one')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                target === 'one' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >Bitta o&apos;quvchi</button>
            <button
              onClick={() => setTarget('all')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                target === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >Barcha o&apos;quvchilar</button>
          </div>

          {/* Bitta o'quvchi tanlash */}
          {target === 'one' && (
            selected ? (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700 text-xs font-bold">
                  {selected.firstName.charAt(0)}{selected.lastName.charAt(0)}
                </div>
                <p className="text-sm font-medium text-gray-900 flex-1 truncate">{selected.firstName} {selected.lastName}</p>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-red-500 transition"><X size={14} /></button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={14} /></span>
                  <input
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="O'quvchi ismini kiriting..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {searching && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs animate-spin">⟳</span>
                  )}
                </div>
                {results.length > 0 && (
                  <div className="mt-1.5 border border-gray-100 rounded-xl max-h-48 overflow-y-auto">
                    {results.map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setSelected(s); setQ(''); setResults([]); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-none text-left"
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-gray-600 text-xs font-bold">
                          {s.firstName.charAt(0)}{s.lastName.charAt(0)}
                        </div>
                        <p className="text-sm text-gray-900 truncate">{s.firstName} {s.lastName}</p>
                      </button>
                    ))}
                  </div>
                )}
                {q.trim().length >= 2 && !searching && results.length === 0 && (
                  <p className="text-xs text-gray-400 mt-2 text-center">Hech kim topilmadi</p>
                )}
              </div>
            )
          )}

          {/* Sarlavha */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Sarlavha</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value.slice(0, 300))}
              placeholder="Masalan: Ertaga dars bekor"
              className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Matn */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Xabar matni</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              placeholder="Xabar matnini yozing..."
              className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {success && <p className="text-xs text-emerald-600">{success}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={() => sendMut.mutate()}
            disabled={!canSend || sendMut.isPending}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 transition-colors"
          >
            <Send size={14} />
            {sendMut.isPending ? 'Yuborilmoqda...' : target === 'all' ? "Barchaga yuborish" : 'Yuborish'}
          </button>
        </div>
      </div>
    </div>
  );
}
