'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { BOOK_STATUS_META } from '@/types/gamification';
import type { Book, BookStatus } from '@/types/gamification';

const STATUS_FILTERS: Array<{ v: BookStatus | 'all'; label: string }> = [
  { v: 'all',         label: 'Barchasi'     },
  { v: 'not_started', label: 'Boshlanmagan' },
  { v: 'reading',     label: "O'qilyapti"   },
  { v: 'completed',   label: 'Tugallandi'   },
  { v: 'tested',      label: 'Test topshirildi' },
];

export default function BookclubTab({ canAdd }: { canAdd: boolean }) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<BookStatus | 'all'>('all');
  const [activeBook,   setActiveBook]   = useState<Book | null>(null);
  const [addOpen,      setAddOpen]      = useState(false);

  const { data: books = [], isLoading } = useQuery({
    queryKey: ['books'],
    queryFn:  () => api.get<Book[]>('/gamification/books').then(r => r.data),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookStatus }) =>
      api.patch(`/gamification/books/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['books'] }),
  });

  const filtered = statusFilter === 'all'
    ? books
    : books.filter(b => b.myStatus === statusFilter);

  return (
    <div className="space-y-4">
      {/* Filtr + qo'shish */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.v}
              onClick={() => setStatusFilter(f.v as BookStatus | 'all')}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors border ${
                statusFilter === f.v
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {canAdd && (
          <button
            onClick={() => setAddOpen(true)}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-medium transition-colors"
          >
            + Kitob qo'shish
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
          <div className="text-4xl">📖</div>
          <p className="text-sm">Kitoblar topilmadi</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(book => {
            const meta = BOOK_STATUS_META[book.myStatus];
            return (
              <div
                key={book.id}
                className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer group"
                onClick={() => setActiveBook(activeBook?.id === book.id ? null : book)}
              >
                {/* Muqova */}
                <div className="h-36 bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center relative">
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-5xl">📖</span>
                  )}
                  <div className={`absolute top-2 right-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.color} bg-white/90`}>
                    {meta.icon} {meta.label}
                  </div>
                </div>

                {/* Ma'lumot */}
                <div className="p-3">
                  <h3 className="text-xs font-semibold text-gray-900 line-clamp-2">{book.title}</h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">{book.author}</p>

                  {book.myScore != null && (
                    <div className={`mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                      book.myScore >= book.passScore
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      ⭐ {book.myScore}% ball
                    </div>
                  )}

                  {/* Holat tugmalari */}
                  {book.myStatus !== 'tested' && (
                    <div className="mt-2 flex gap-1" onClick={e => e.stopPropagation()}>
                      {book.myStatus === 'not_started' && (
                        <button
                          onClick={() => statusMut.mutate({ id: book.id, status: 'reading' })}
                          className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-medium hover:bg-blue-100 transition-colors"
                        >
                          Boshlash
                        </button>
                      )}
                      {book.myStatus === 'reading' && (
                        <button
                          onClick={() => statusMut.mutate({ id: book.id, status: 'completed' })}
                          className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-medium hover:bg-emerald-100 transition-colors"
                        >
                          Tugallash
                        </button>
                      )}
                      {book.myStatus === 'completed' && book.hasTest && (
                        <button
                          className="text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded-lg font-medium hover:bg-amber-100 transition-colors"
                        >
                          📝 AI test
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Kitob qo'shish modal (SA uchun) */}
      {addOpen && <AddBookModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddBookModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title,  setTitle]  = useState('');
  const [author, setAuthor] = useState('');
  const [desc,   setDesc]   = useState('');
  const [pages,  setPages]  = useState('');

  const mut = useMutation({
    mutationFn: () => api.post('/gamification/books', {
      title: title.trim(),
      author: author.trim(),
      description: desc.trim() || undefined,
      pageCount: pages ? +pages : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['books'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">📖 Kitob qo'shish</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-gray-100 text-gray-400 flex items-center justify-center">✕</button>
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Kitob nomi *"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Muallif *"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Qisqacha tavsif"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
        <input type="number" value={pages} onChange={e => setPages(e.target.value)} placeholder="Sahifalar soni"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors">Bekor</button>
          <button
            onClick={() => { if (title && author) mut.mutate(); }}
            disabled={mut.isPending || !title || !author}
            className="px-5 py-2 text-sm font-medium bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {mut.isPending ? 'Saqlanmoqda...' : "Qo'shish"}
          </button>
        </div>
      </div>
    </div>
  );
}
