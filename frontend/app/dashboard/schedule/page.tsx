'use client';

import { School, X } from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import LessonCard from '@/components/schedule/LessonCard';
import CreateLessonModal from '@/components/schedule/CreateLessonModal';
import SubstituteModal from '@/components/schedule/SubstituteModal';
import GenerateMonthBanner from '@/components/schedule/GenerateMonthBanner';
import AnalysisPanel from '@/components/schedule/AnalysisPanel';
import MonthlyAnalysisPanel from '@/components/schedule/MonthlyAnalysisPanel';
import { DAYS_UZ } from '@/types/schedule';
import type { WeekScheduleResponse, ScheduleLesson, ConflictResult } from '@/types/schedule';

// ─── SANA FORMATI ─────────────────────────────────────────────────────────────
const MONTHS = ['Yan','Fev','Mar','Apr','May','Iyu','Iul','Avg','Sen','Okt','Noy','Dek'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}-${MONTHS[d.getMonth()]}`;
}

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const yr = e.getFullYear();
  const sm = MONTHS[s.getMonth()];
  const em = MONTHS[e.getMonth()];
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${em} ${yr}`;
  }
  return `${s.getDate()} ${sm} – ${e.getDate()} ${em} ${yr}`;
}

// ─── HAFTA HISOBLASH ──────────────────────────────────────────────────────────
// Mahalliy sana qatorini (YYYY-MM-DD) hisoblaydi — toISOString() UTC'ga
// o'giradi va UTC+5 kabi mintaqalarda sanani bir kun orqaga surib yuboradi.
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMondayOf(date: Date): string {
  const d   = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return toLocalDateStr(d);
}

function addDays(dateStr: string, n: number): string {
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day + n);
  return toLocalDateStr(d);
}

// ─── API TURLARI ──────────────────────────────────────────────────────────────
interface ApiTimeSlot { id: string; name: string; startTime: string; endTime: string; isActive: boolean; orderIndex: number; }
interface ApiRoom     { id: string; name: string; number: string; capacity: number; isActive: boolean; orderIndex: number; }

// ─── API ──────────────────────────────────────────────────────────────────────
const fetchWeek = (params: object) =>
  api.get<WeekScheduleResponse>('/schedule/week', { params }).then(r => r.data);

// ─── ASOSIY SAHIFA ────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const qc   = useQueryClient();
  const user = useAuthStore(s => s.user);
  const role = user?.role ?? 'manager';

  const [weekStart,  setWeekStart]  = useState(() => getMondayOf(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => toLocalDateStr(new Date()));
  const [filterRoom, setFilterRoom] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [showAnalysis,  setShowAnalysis]  = useState(false);

  // Hafta almashganda mobil kunlik ro'yxat tanlovini yangilash — bugun shu
  // hafta ichida bo'lsa bugunni, aks holda hafta boshini tanlaydi
  useEffect(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const todayStr = toLocalDateStr(new Date());
    setSelectedDay(days.includes(todayStr) ? todayStr : weekStart);
  }, [weekStart]);

  // Modallar
  const [createModal, setCreateModal] = useState<{
    open: boolean; day?: string; room?: string; slot?: { start: string; end: string }; lesson?: ScheduleLesson | null;
  }>({ open: false });
  const [subModal, setSubModal] = useState<ScheduleLesson | null>(null);

  // Drag & Drop holati
  const dragLesson = useRef<ScheduleLesson | null>(null);
  const [dragId,     setDragId]     = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ day: string; room: string } | null>(null);
  const [conflictDrop, setConflictDrop] = useState<boolean>(false);

  // Paralar va xonalar DB dan
  const { data: timeSlots } = useQuery({
    queryKey: ['time-slots'],
    queryFn:  () => api.get<ApiTimeSlot[]>('/schedule/time-slots?active=true').then(r => r.data),
    staleTime: 5 * 60_000,
  });
  const { data: rooms } = useQuery({
    queryKey: ['rooms'],
    queryFn:  () => api.get<ApiRoom[]>('/schedule/rooms?active=true').then(r => r.data),
    staleTime: 5 * 60_000,
  });

  // API
  const { data, isLoading } = useQuery({
    queryKey: ['week-schedule', weekStart, filterRoom, filterTeacher, filterSubject],
    queryFn:  () => fetchWeek({
      weekStart,
      ...(filterRoom    && { roomNumber: filterRoom }),
      ...(filterTeacher && { teacherId:  filterTeacher }),
      ...(filterSubject && { subjectId:  filterSubject }),
    }),
    refetchInterval: 60_000,
  });

  const moveMut = useMutation({
    mutationFn: ({ id, day, room }: { id: string; day: string; room: string }) =>
      api.patch(`/schedule/lesson/${id}`, { lessonDate: day, roomNumber: room }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['week-schedule'] }),
  });

  // ─── DRAG & DROP ────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, lesson: ScheduleLesson) => {
    dragLesson.current = lesson;
    setDragId(lesson.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDropTarget(null);
    setConflictDrop(false);
    dragLesson.current = null;
  }, []);

  const handleDragOver = useCallback(async (
    e: React.DragEvent,
    day: string,
    room: string,
  ) => {
    e.preventDefault();
    const lesson = dragLesson.current;
    if (!lesson || (lesson.lessonDate === day && lesson.roomNumber === room)) {
      setDropTarget(null);
      return;
    }
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ day, room });

    // Asinxron konflikt tekshirish
    try {
      const res = await api.post<ConflictResult>('/schedule/check-conflict', {
        lessonDate:      day,
        startTime:       lesson.startTime,
        endTime:         lesson.endTime,
        roomNumber:      room,
        teacherId:       lesson.teacher.id,
        excludeLessonId: lesson.id,
        groupId:         lesson.group.id,
      });
      setConflictDrop(res.data.hasConflict);
    } catch {
      setConflictDrop(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, day: string, room: string) => {
    e.preventDefault();
    const lesson = dragLesson.current;
    if (!lesson || conflictDrop) return;
    if (lesson.lessonDate === day && lesson.roomNumber === room) return;
    moveMut.mutate({ id: lesson.id, day, room });
    setDropTarget(null);
    setConflictDrop(false);
  }, [conflictDrop, moveMut]);

  const canEdit = role === 'super_admin' || role === 'manager';

  // ─── HAFTA KUNLARI ──────────────────────────────────────────────────────────
  const weekDays = data?.weekDays ?? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today    = toLocalDateStr(new Date());

  return (
    <div className="flex gap-5 h-[calc(100vh-5rem)] overflow-hidden">

      {/* ── ASOSIY JADVAL ────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Sarlavha + navigatsiya */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekStart(w => addDays(w, -7))}
              className="w-8 h-8 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm transition-colors">
              ‹
            </button>
            <button onClick={() => setWeekStart(getMondayOf(new Date()))}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
              Bugun
            </button>
            <button onClick={() => setWeekStart(w => addDays(w, 7))}
              className="w-8 h-8 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm transition-colors">
              ›
            </button>
            <span className="text-sm font-medium text-gray-700 ml-1">
              {formatWeekRange(weekDays[0], weekDays[6])}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Xona filtri */}
            <select value={filterRoom} onChange={e => setFilterRoom(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
              <option value="">Barcha xona</option>
              {(rooms ?? []).map(r => (
                <option key={r.number} value={r.number}>{r.name}</option>
              ))}
            </select>

            <button onClick={() => setShowAnalysis(s => !s)}
              className={`hidden md:inline-flex px-3 py-1.5 text-xs border rounded-xl transition-colors ${
                showAnalysis ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              Tahlil
            </button>

            {canEdit && (
              <button onClick={() => setCreateModal({ open: true })}
                className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors">
                + Dars
              </button>
            )}
          </div>
        </div>

        {/* Oylik jadval avtomatik generatsiya taklifi */}
        {canEdit && (
          <div className="shrink-0">
            <GenerateMonthBanner month={weekStart.slice(0, 7)} />
          </div>
        )}

        {/* Grid (desktop — hafta × xona) */}
        <div className="hidden md:block flex-1 overflow-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
          <div className="min-w-[900px]">
            {/* Header: Para + kunlar */}
            <div className="grid sticky top-0 z-10 bg-white border-b border-gray-100"
              style={{ gridTemplateColumns: '80px 64px repeat(7, 1fr)' }}>
              <div className="px-2 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Para</div>
              <div className="px-2 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Xona</div>
              {weekDays.map((day, i) => (
                <div key={day} className={`px-3 py-3 text-center ${day === today ? 'bg-primary-50' : ''}`}>
                  <p className={`text-xs font-semibold ${day === today ? 'text-emerald-700' : 'text-gray-600'}`}>
                    {DAYS_UZ[i]}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${day === today ? 'text-emerald-500' : 'text-gray-400'}`}>
                    {formatDate(day)}
                  </p>
                  {day === today && (
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mx-auto mt-1" />
                  )}
                </div>
              ))}
            </div>

            {/* Jadval satrlari: para × xona */}
            {isLoading
              ? Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="grid h-16 border-b border-gray-50 animate-pulse"
                    style={{ gridTemplateColumns: '80px 64px repeat(7, 1fr)' }}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <div key={j} className="m-1 bg-gray-100 rounded-xl" />
                    ))}
                  </div>
                ))
              : !timeSlots?.length ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <div className="text-4xl mb-3">⏰</div>
                    <p className="text-sm font-medium text-gray-500">Paralar sozlanmagan</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Sozlamalar → Paralar bo'limidan qo'shing
                    </p>
                  </div>
                )
              : !rooms?.length ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <div className="text-4xl mb-3"><School size={36} /></div>
                    <p className="text-sm font-medium text-gray-500">Xonalar sozlanmagan</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Sozlamalar → Xonalar bo'limidan qo'shing
                    </p>
                  </div>
                )
              : (timeSlots ?? []).map((slot, slotIdx) =>
                  (rooms ?? []).map((room, roomIdx) => {
                    const isFirstInSlot = roomIdx === 0;
                    const isLastInSlot  = roomIdx === (rooms ?? []).length - 1;

                    return (
                      <div
                        key={`${slot.startTime}-${room.number}`}
                        className={`grid border-b ${isLastInSlot ? 'border-gray-200' : 'border-gray-50'}`}
                        style={{ gridTemplateColumns: '80px 64px repeat(7, 1fr)' }}
                      >
                        {/* Para label (faqat birinchi xona satri) */}
                        <div className={`px-2 py-2 flex items-start ${isFirstInSlot ? '' : 'border-t-0'}`}>
                          {isFirstInSlot && (
                            <div className="sticky top-12">
                              <p className="text-[10px] font-bold text-gray-500 uppercase">{slot.name}</p>
                              <p className="text-[9px] text-gray-400 leading-tight">{slot.startTime}</p>
                              <p className="text-[9px] text-gray-400 leading-tight">{slot.endTime}</p>
                            </div>
                          )}
                        </div>

                        {/* Xona label */}
                        <div className="px-2 py-2 flex items-center">
                          <div className="text-center">
                            <p className="text-[11px] font-semibold text-gray-600">{room.number}</p>
                            <p className="text-[9px] text-gray-400">{room.capacity}o'r</p>
                          </div>
                        </div>

                        {/* Kunlar × xona katakchasi */}
                        {weekDays.map(day => {
                          const lessonsInCell = (data?.grid[day]?.[room.number] ?? [])
                            .filter(l => l.startTime === slot.startTime);
                          const isTarget  = dropTarget?.day === day && dropTarget?.room === room.number;
                          const isToday   = day === today;

                          return (
                            <div
                              key={`${day}-${room.number}-${slot.startTime}`}
                              className={`min-h-[64px] p-1.5 border-l border-gray-50 transition-colors
                                ${isToday ? 'bg-primary-50/30' : ''}
                                ${isTarget && !conflictDrop ? 'bg-primary-100 ring-2 ring-primary-400 ring-inset' : ''}
                                ${isTarget && conflictDrop  ? 'bg-red-100 ring-2 ring-red-400 ring-inset' : ''}
                              `}
                              onDragOver={e => handleDragOver(e, day, room.number)}
                              onDragLeave={() => { setDropTarget(null); setConflictDrop(false); }}
                              onDrop={e => handleDrop(e, day, room.number)}
                            >
                              {lessonsInCell.length > 0 ? (
                                lessonsInCell.map(lesson => (
                                  <LessonCard
                                    key={lesson.id}
                                    lesson={lesson}
                                    dragging={dragId === lesson.id}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => canEdit && setCreateModal({ open: true, lesson })}
                                    onTeacherClick={setSubModal}
                                    compact={false}
                                  />
                                ))
                              ) : (
                                canEdit ? (
                                  <button
                                    onClick={() => setCreateModal({ open: true, day, room: room.number, slot: { start: slot.startTime, end: slot.endTime } })}
                                    className={`w-full h-full min-h-[52px] rounded-xl border-2 border-dashed text-xs transition-all flex items-center justify-center gap-1
                                      ${dragId ? 'border-transparent' : 'border-gray-200 text-gray-300 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50'}
                                    `}
                                  >
                                    {!dragId && <><span className="text-base">+</span> <span>Dars</span></>}
                                  </button>
                                ) : (
                                  <div className="w-full h-full min-h-[52px] rounded-xl bg-emerald-50/50" />
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  }),
                )
            }
          </div>
        </div>

        {/* Mobil — kunlik ro'yxat (agenda) */}
        <div className="md:hidden flex-1 flex flex-col overflow-hidden">
          {/* Kun tanlagich */}
          <div className="flex gap-1.5 overflow-x-auto pb-3 shrink-0">
            {weekDays.map((day, i) => {
              const isSelected = day === selectedDay;
              const isToday    = day === today;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`flex flex-col items-center justify-center shrink-0 w-12 h-14 rounded-2xl border transition-colors ${
                    isSelected
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : isToday
                      ? 'border-primary-300 text-primary-700'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >
                  <span className="text-[10px] font-medium">{DAYS_UZ[i]?.slice(0, 3)}</span>
                  <span className="text-sm font-bold">{Number(day.slice(8, 10))}</span>
                </button>
              );
            })}
          </div>

          {/* Tanlangan kun darslari */}
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))
            ) : !timeSlots?.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <div className="text-4xl mb-3">⏰</div>
                <p className="text-sm font-medium text-gray-500">Paralar sozlanmagan</p>
              </div>
            ) : (
              (timeSlots ?? []).map(slot => {
                const lessonsInSlot = (rooms ?? []).flatMap(room =>
                  (data?.grid[selectedDay]?.[room.number] ?? []).filter(l => l.startTime === slot.startTime),
                );
                return (
                  <div key={slot.startTime}>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1.5">
                      {slot.name} · {slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}
                    </p>
                    {lessonsInSlot.length > 0 ? (
                      <div className="space-y-2">
                        {lessonsInSlot.map(lesson => (
                          <LessonCard
                            key={lesson.id}
                            lesson={lesson}
                            dragging={false}
                            onDragStart={() => {}}
                            onDragEnd={() => {}}
                            onClick={() => canEdit && setCreateModal({ open: true, lesson })}
                            onTeacherClick={setSubModal}
                            compact={false}
                          />
                        ))}
                      </div>
                    ) : canEdit ? (
                      <button
                        onClick={() => setCreateModal({
                          open: true, day: selectedDay,
                          slot: { start: slot.startTime, end: slot.endTime },
                        })}
                        className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-300 text-xs hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                      >
                        + Dars qo'shish
                      </button>
                    ) : (
                      <div className="py-3 text-center text-xs text-gray-300">Dars yo'q</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Izoh */}
        {dragId && (
          <div className="mt-2 text-xs text-center text-gray-400 hidden md:block">
            Yashil = bo'sh  •  Qizil = band  •  Tashlash uchun maqsad xonaga sudrang
          </div>
        )}
      </div>

      {/* ── TAHLIL PANELI ────────────────────────────────────────────── */}
      {showAnalysis && data && (
        <aside className="w-72 shrink-0 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Hafta tahlili</h3>
            <button onClick={() => setShowAnalysis(false)}
              className="text-gray-400 hover:text-gray-600 text-sm"><X size={16} /></button>
          </div>
          <AnalysisPanel summary={data.summary} />

          {/* Oylik daromad / o'qituvchi / guruh tahlili — moliyaviy ma'lumot, faqat SA/manager */}
          {canEdit && (
            <div className="pt-2 border-t border-gray-100">
              <MonthlyAnalysisPanel />
            </div>
          )}

          {/* Legenda */}
          <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-1.5">
            <p className="text-xs font-medium text-gray-500 mb-2">Dars holatlari</p>
            {[
              { color: 'bg-blue-400',   label: 'Rejalashtirilgan' },
              { color: 'bg-emerald-400',label: 'Tugallangan' },
              { color: 'bg-purple-400', label: 'O\'rinbosar' },
              { color: 'bg-gray-400',   label: 'Bekor' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
                <span className="text-xs text-gray-600">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Bu hafta xulosasi */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Hafta xulosasi</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Jami dars:</span>
                <span className="font-semibold">{data.summary.totalLessons} ta</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Bo'sh slot:</span>
                <span className="font-semibold text-emerald-600">{data.summary.freeSlots} ta</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Jami:</span>
                <span className="font-semibold">{7 * 4 * 5} slot</span>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ── MODALAR ──────────────────────────────────────────────────── */}
      <CreateLessonModal
        open={createModal.open}
        onClose={() => setCreateModal({ open: false })}
        preDay={createModal.day}
        preRoom={createModal.room}
        preSlot={createModal.slot}
        lesson={createModal.lesson ?? undefined}
      />

      <SubstituteModal
        lesson={subModal}
        onClose={() => setSubModal(null)}
      />
    </div>
  );
}
