'use client';

import { Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { TestDifficulty, TestWithQuestions } from '@/types/lms';
import { DIFFICULTY_META } from '@/types/lms';

interface Props {
  subjectId: string;
  groupId:   string | null;
  test?:     TestWithQuestions;   // berilsa — tahrirlash rejimi (PATCH), aks holda yangi test (POST)
  onClose:   () => void;
  onSaved?:  () => void;
}

interface GroupOption {
  id:   string;
  name: string;
}

interface QuestionDraft {
  id?:         string;   // yo'q = hali saqlanmagan yangi qoralama
  text:        string;
  options:     string[];
  optionIds?:  string[]; // mavjud savolda haqiqiy id'lar saqlanadi — qayta
                          // saqlashda o'zgarmaydi (aks holda eski natijalarning
                          // saqlangan javobi yangi id bilan mos kelmay qolardi)
  correct:     number;
  difficulty:  TestDifficulty;
  topic:       string;
}

function emptyQuestion(): QuestionDraft {
  return { text: '', options: ['', '', '', ''], correct: 0, difficulty: 'medium', topic: '' };
}

// Mavjud savolni draft shakliga o'tkazish — 4 tadan ko'p/kam variant bo'lsa
// ham birinchi 4 tasi ko'rsatiladi (forma hozircha 4 variantga mo'ljallangan)
function questionToDraft(q: TestWithQuestions['questions'][number]): QuestionDraft {
  const optionTexts = q.options.map((o) => o.text);
  const optionIds = q.options.map((o) => o.id);
  while (optionTexts.length < 4) { optionTexts.push(''); optionIds.push(String(optionTexts.length - 1)); }
  const correctIdx = q.options.findIndex((o) => o.id === q.correctAnswer);
  return {
    id: q.id,
    text: q.question,
    options: optionTexts.slice(0, 4),
    optionIds: optionIds.slice(0, 4),
    correct: correctIdx >= 0 ? correctIdx : 0,
    difficulty: q.difficulty,
    topic: q.topic ?? '',
  };
}

// Savolni backend AddQuestionDto/UpdateQuestionDto shakliga o'tkazish —
// mavjud savolda haqiqiy option id'lar saqlanadi, yangisida ketma-ket ("0".."3")
function questionPayload(q: QuestionDraft) {
  const correctAnswer = q.optionIds?.[q.correct] ?? String(q.correct);
  // Bo'sh variant slotlari (masalan asl 2-3 variantli savolni 4 slotli
  // formada ko'rsatish uchun to'ldirilgan bo'sh joy) backendga yuborilmaydi
  const options = q.options
    .map((text, i) => ({ id: q.optionIds?.[i] ?? String(i), text }))
    .filter((o) => o.text.trim() || o.id === correctAnswer);
  return {
    question: q.text,
    options,
    correctAnswer,
    difficulty: q.difficulty,
    points: 1,
    topic: q.topic.trim() || undefined,
  };
}

export default function CreateTestModal({ subjectId, test, onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const isEdit = !!test;

  const [title,          setTitle]          = useState(test?.title ?? '');
  const [level,          setLevel]          = useState(test?.level ?? '');
  const [duration,       setDuration]       = useState(test?.timeLimitMinutes ?? 30);
  const [questionsToShow,setQuestionsToShow]= useState(test?.questionsToShow ?? 10);
  const [maxAttempts,    setMaxAttempts]    = useState(test?.maxAttempts ?? 3);
  const [livesLimit,     setLivesLimit]     = useState(test?.livesLimit != null ? String(test.livesLimit) : '');
  const [groupIds,       setGroupIds]       = useState<string[]>(test?.visibleGroups?.map(g => g.id) ?? []);
  const [isExam,         setIsExam]         = useState(test ? test.resultsAutoVisible === false : false);
  const [questions,      setQuestions]      = useState<QuestionDraft[]>(
    test?.questions?.length ? test.questions.map(questionToDraft) : [emptyQuestion()],
  );
  const [error,          setError]          = useState('');
  const [activeQ,        setActiveQ]        = useState(0);
  const [saving,         setSaving]         = useState(false);
  const [importOpen,     setImportOpen]     = useState(false);
  const [importText,     setImportText]     = useState('');
  const [importError,    setImportError]    = useState('');

  // Shu fanning guruhlari — "qaysi guruhlarga ko'rinsin" tanlovi uchun
  const { data: groups = [] } = useQuery({
    queryKey: ['lms-groups', subjectId],
    queryFn:  () => api.get<{ data: GroupOption[] }>('/groups', {
      params: { subjectId, isActive: 'true', limit: 50 },
    }).then(r => r.data.data),
  });

  function toggleGroup(id: string) {
    setGroupIds(gs => gs.includes(id) ? gs.filter(g => g !== id) : [...gs, id]);
  }

  const livesLimitValue = livesLimit.trim() ? Number(livesLimit) : null;

  const saveMut = useMutation({
    mutationFn: async () => {
      if (isEdit && test) {
        // Sozlamalarni yangilash
        await api.patch(`/tests/${test.id}`, {
          title,
          timeLimitMinutes: duration,
          questionsToShow,
          maxAttempts,
          level: level.trim() || null,
          groupIds,
          resultsAutoVisible: !isExam,
          livesLimit: livesLimitValue,
        });

        // Savollarni moslashtirish — o'zgarganlari PATCH, yangilari POST
        const original = new Map(test.questions.map((q) => [q.id, q]));
        await Promise.all(
          questions.map((q) => {
            if (!q.id) return api.post(`/tests/${test.id}/questions`, questionPayload(q));
            const before = original.get(q.id);
            const draftFromOriginal = before ? questionToDraft(before) : null;
            const unchanged = draftFromOriginal && JSON.stringify(draftFromOriginal) === JSON.stringify(q);
            if (unchanged) return Promise.resolve();
            return api.patch(`/tests/${test.id}/questions/${q.id}`, questionPayload(q));
          }),
        );

        return test;
      }

      // Yangi test — qobig'ini yaratib, savollarni qo'shib, tekshiruvga yuboramiz
      const { data: created } = await api.post<{ id: string }>('/tests', {
        title,
        subjectId,
        timeLimitMinutes: duration,
        questionsToShow,
        totalQuestions: questions.length,
        maxAttempts,
        scoreMethod: 'best',
        ...(level.trim() && { level: level.trim() }),
        ...(groupIds.length > 0 && { groupIds }),
        ...(isExam && { resultsAutoVisible: false }),
        ...(livesLimitValue !== null && { livesLimit: livesLimitValue }),
      });

      await Promise.all(
        questions.map((q) => api.post(`/tests/${created.id}/questions`, questionPayload(q))),
      );

      // Tekshiruvga yuborish — "Saqlangach manager tekshiruviga ketadi"
      // va'dasini bajarish (savol soni yuqorida handleSubmit'da allaqachon
      // tekshirilgan, shuning uchun bu chaqiruv doim muvaffaqiyatli bo'ladi)
      await api.patch(`/tests/${created.id}/status`, { status: 'review' });

      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tests', subjectId] });
      qc.invalidateQueries({ queryKey: ['subjects'] });
      qc.invalidateQueries({ queryKey: ['test-detail', test?.id] });
      onSaved?.();
      onClose();
    },
    onError: () => setError('Saqlashda xatolik yuz berdi'),
    onSettled: () => setSaving(false),
  });

  // Mavjud savol — darhol o'chiriladi (soft-delete, xavfi kam); yangi
  // qoralama — faqat mahalliy ro'yxatdan olib tashlanadi
  // Faqat mavjud savol (id bor) uchun chaqiriladi — test prop shu holatda
  // har doim bor (removeQuestion'dagi shart shuni kafolatlaydi)
  const deleteQuestionMut = useMutation({
    mutationFn: (questionId: string) => api.delete(`/tests/${test!.id}/questions/${questionId}`),
  });

  function handleSubmit() {
    setError('');
    if (!title.trim()) { setError("Sarlavha kiritilishi shart"); return; }
    if (questions.length < questionsToShow) {
      setError(`Kamida ${questionsToShow} ta savol kerak (ko'rsatiladigan savollar soniga mos)`);
      return;
    }
    // Kamida 2 ta to'ldirilgan variant kifoya — mavjud savolni tahrirlashda
    // (masalan asl 2-3 variantli savol) bo'sh 3/4-variant to'ldirilishini
    // majburlamaydi
    const invalid = questions.findIndex(q =>
      !q.text.trim() || q.options.filter(o => o.trim()).length < 2
    );
    if (invalid >= 0) {
      setError(`${invalid + 1}-savol to'ldirilmagan`);
      setActiveQ(invalid);
      return;
    }
    setSaving(true);
    saveMut.mutate();
  }

  function updateQuestion(i: number, patch: Partial<QuestionDraft>) {
    setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  }

  function updateOption(qi: number, oi: number, val: string) {
    setQuestions(qs => qs.map((q, idx) =>
      idx === qi ? { ...q, options: q.options.map((o, j) => j === oi ? val : o) } : q
    ));
  }

  function addQuestion() {
    setQuestions(qs => [...qs, emptyQuestion()]);
    setActiveQ(questions.length);
  }

  // Matndan bir nechta savolni birdaniga import qilish. Format: har savol
  // bo'sh qatordan ajratilgan — 1-qator savol matni, keyingi qatorlar
  // variantlar ("*" bilan boshlangani — to'g'ri javob), "#" bilan
  // boshlangan qator — mavzu (ixtiyoriy)
  function parseImportText(text: string): { drafts: QuestionDraft[]; error: string } {
    const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    const drafts: QuestionDraft[] = [];
    for (const [i, block] of blocks.entries()) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const topicLine = lines.find(l => l.startsWith('#'));
      const contentLines = lines.filter(l => !l.startsWith('#'));
      if (contentLines.length < 3) {
        return { drafts: [], error: `${i + 1}-blok: savol matni va kamida 2 ta variant kerak` };
      }
      const [qText, ...optionLines] = contentLines;
      const options = optionLines.slice(0, 4).map(l => l.replace(/^\*/, '').trim());
      while (options.length < 4) options.push('');
      const correct = optionLines.findIndex(l => l.startsWith('*'));
      if (correct < 0) {
        return { drafts: [], error: `${i + 1}-blok ("${qText}"): to'g'ri javob "*" bilan belgilanmagan` };
      }
      drafts.push({
        text: qText,
        options,
        correct,
        difficulty: 'medium',
        topic: topicLine ? topicLine.replace(/^#/, '').trim() : '',
      });
    }
    return { drafts, error: '' };
  }

  function handleImport() {
    const { drafts, error: parseErr } = parseImportText(importText);
    if (parseErr) { setImportError(parseErr); return; }
    if (drafts.length === 0) { setImportError('Hech qanday savol topilmadi'); return; }
    setQuestions(qs => {
      const withoutEmpty = qs.filter(q => q.text.trim() || q.options.some(o => o.trim()));
      return [...withoutEmpty, ...drafts];
    });
    setImportText('');
    setImportError('');
    setImportOpen(false);
  }

  function removeQuestion(i: number) {
    if (questions.length <= 1) return;
    const q = questions[i];
    if (q.id) deleteQuestionMut.mutate(q.id);
    setQuestions(qs => qs.filter((_, idx) => idx !== i));
    setActiveQ(Math.min(i, questions.length - 2));
  }

  const diffCounts = (['easy', 'medium', 'hard'] as const).map(d => ({
    d, count: questions.filter(q => q.difficulty === d).length,
  }));

  // Edit rejimida TestDetailModal o'zining backdrop/qobig'ini beradi — bu
  // yerda faqat ichki kontent (sarlavhasiz, o'z modal qobig'isiz) ko'rsatiladi
  return (
    <div className={isEdit ? 'h-full' : 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4'}>
      <div className={isEdit ? 'flex flex-col h-full' : 'bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col'}>
        {/* Sarlavha */}
        {!isEdit && (
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Test draft yaratish</h2>
              <p className="text-xs text-gray-400 mt-0.5">Saqlangach manager tekshiruviga ketadi</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"><X size={16} /></button>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Chap: sozlamalar + savol ro'yxati */}
          <div className="w-56 shrink-0 border-r border-gray-100 flex flex-col">
            <div className="p-4 space-y-3 border-b border-gray-100">
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase mb-1 block">Sarlavha</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Test nomi"
                  className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-gray-500 mb-1 block">Daqiqa</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={duration}
                    onChange={e => setDuration(+e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 mb-1 block">Ko'rsatiladi</label>
                  <input
                    type="number"
                    min={1}
                    max={questions.length}
                    value={questionsToShow}
                    onChange={e => setQuestionsToShow(+e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-gray-500 mb-1 block">Urinishlar soni</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxAttempts}
                    onChange={e => setMaxAttempts(+e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 mb-1 block">Jon (ixtiyoriy)</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={livesLimit}
                    onChange={e => setLivesLimit(e.target.value)}
                    placeholder="Cheksiz"
                    className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 -mt-2">
                Jon — nechta xato javobdan keyin urinish avtomatik tugaydi. Bo&apos;sh = cheksiz, oxirigacha ishlaydi
              </p>
              <div>
                <label className="text-[10px] font-medium text-gray-500 mb-1 block">Daraja (ixtiyoriy)</label>
                <input
                  value={level}
                  onChange={e => setLevel(e.target.value)}
                  placeholder="Beginner, B1, B2..."
                  className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <label className="flex items-start gap-2 px-1 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isExam}
                  onChange={e => setIsExam(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-xs text-gray-700">
                  Nazorat ishi
                  <span className="block text-[10px] text-gray-400">O'quvchi natijasini siz ochmaguncha ko'rmaydi</span>
                </span>
              </label>
              {groups.length > 0 && (
                <div>
                  <label className="text-[10px] font-medium text-gray-500 mb-1 block">
                    Qaysi guruhlarga ko&apos;rinsin
                  </label>
                  <p className="text-[10px] text-gray-400 mb-1.5">Hech biri tanlanmasa — barcha guruhga</p>
                  <div className="max-h-28 overflow-y-auto space-y-1 border border-gray-200 rounded-xl p-1.5">
                    {groups.map(g => (
                      <label key={g.id} className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-gray-50 cursor-pointer text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={groupIds.includes(g.id)}
                          onChange={() => toggleGroup(g.id)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        {g.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Daraja statistika */}
              <div className="flex gap-1.5 flex-wrap">
                {diffCounts.map(({ d, count }) => count > 0 ? (
                  <span key={d} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${DIFFICULTY_META[d].bg} ${DIFFICULTY_META[d].color}`}>
                    {DIFFICULTY_META[d].label[0]}: {count}
                  </span>
                ) : null)}
              </div>
            </div>

            {/* Savol ro'yxati */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setActiveQ(i)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                    activeQ === i
                      ? 'bg-emerald-50 text-emerald-800 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${DIFFICULTY_META[q.difficulty].bg} ${DIFFICULTY_META[q.difficulty].color}`}>
                    {i + 1}
                  </span>
                  <span className="truncate">{q.text || 'Savol...'}</span>
                </button>
              ))}
              <button
                onClick={addQuestion}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
              >
                + Savol qo'shish
              </button>
              <button
                onClick={() => setImportOpen(o => !o)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
              >
                📋 Matndan import
              </button>
              {importOpen && (
                <div className="p-2 space-y-2 border-t border-gray-100 mt-1">
                  <textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder={'Savol matni\n*To\'g\'ri variant\nXato variant\nXato variant\n#Mavzu (ixtiyoriy)\n\nKeyingi savol...'}
                    rows={6}
                    className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono resize-none"
                  />
                  {importError && <p className="text-[10px] text-red-500">{importError}</p>}
                  <button
                    onClick={handleImport}
                    disabled={!importText.trim()}
                    className="w-full text-xs font-medium text-white bg-gray-700 hover:bg-gray-800 disabled:opacity-40 px-3 py-2 rounded-xl transition-colors"
                  >
                    Import qilish
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* O'ng: savol tahrirlash */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {questions[activeQ] && (() => {
              const q = questions[activeQ];
              return (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">{activeQ + 1}-savol</h3>
                    <div className="flex items-center gap-2">
                      {/* Daraja */}
                      <div className="flex gap-1">
                        {(['easy', 'medium', 'hard'] as const).map(d => (
                          <button
                            key={d}
                            onClick={() => updateQuestion(activeQ, { difficulty: d })}
                            className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-colors ${
                              q.difficulty === d
                                ? `${DIFFICULTY_META[d].bg} ${DIFFICULTY_META[d].color}`
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {DIFFICULTY_META[d].label}
                          </button>
                        ))}
                      </div>
                      {questions.length > 1 && (
                        <button
                          onClick={() => removeQuestion(activeQ)}
                          className="text-gray-400 hover:text-red-500 text-xs w-6 h-6 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                        ><Trash2 size={16} /></button>
                      )}
                    </div>
                  </div>

                  {/* Savol matni */}
                  <textarea
                    value={q.text}
                    onChange={e => updateQuestion(activeQ, { text: e.target.value })}
                    placeholder="Savol matnini kiriting..."
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />

                  {/* Mavzu tegi */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Mavzu (ixtiyoriy)</label>
                    <input
                      value={q.topic}
                      onChange={e => updateQuestion(activeQ, { topic: e.target.value })}
                      placeholder="Present Simple, So'z boyligi..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      Guruh qaysi mavzuda ko&apos;proq xato qilayotganini keyin tahlil qilish uchun
                    </p>
                  </div>

                  {/* Variantlar */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">Javob variantlari (to'g'risini belgilang)</label>
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuestion(activeQ, { correct: oi })}
                          className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            q.correct === oi
                              ? 'border-emerald-500 bg-emerald-500'
                              : 'border-gray-300 hover:border-emerald-400'
                          }`}
                        >
                          {q.correct === oi && <span className="w-2 h-2 rounded-full bg-white" />}
                        </button>
                        <input
                          value={opt}
                          onChange={e => updateOption(activeQ, oi, e.target.value)}
                          placeholder={`Variant ${oi + 1}`}
                          className={`flex-1 px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                            q.correct === oi ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Pastki panel */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 gap-3">
          <div className="text-xs text-gray-500">
            {questions.length} ta savol
            {questions.length < questionsToShow && (
              <span className="text-amber-600 ml-2">— kamida {questionsToShow} ta kerak</span>
            )}
          </div>
          {error && <p className="text-xs text-red-500 flex-1">{error}</p>}
          <div className="flex gap-2 shrink-0">
            {!isEdit && <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Bekor</button>}
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saqlanmoqda...' : isEdit ? 'Saqlash' : 'Tekshiruvga yuborish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
