'use client';

import { X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface Props {
  onRecorded: (blob: Blob, durationSeconds: number) => void;
  onCancel:   () => void;
}

export default function AudioRecorder({ onRecorded, onCancel }: Props) {
  const [recording,  setRecording]  = useState(false);
  const [seconds,    setSeconds]    = useState(0);
  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    startRecording();
    return () => stopAll();
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Timeslice bermasdan .start() chaqiramiz — shunda MediaRecorder butun
      // yozuvni bitta yaxlit (to'g'ri yopilgan) WebM sifatida qaytaradi;
      // davriy bo'laklarga bo'lib yig'ish ba'zan konteynerni buzib qo'yardi
      const mr     = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];
      secondsRef.current = 0;

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        // `seconds` state'i eskirgan closure orqali 0 bo'lib qolardi —
        // xabar davomiyligi doim "0:00" ko'rinishining sababi shu edi
        onRecorded(blob, secondsRef.current);
      };

      mr.start();
      mediaRef.current = mr;
      setRecording(true);

      timerRef.current = setInterval(() => setSeconds(s => { secondsRef.current = s + 1; return s + 1; }), 1000);
    } catch {
      onCancel();
    }
  }

  function stopAll() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRef.current?.state === 'recording') mediaRef.current.stop();
  }

  function handleStop() {
    stopAll();
    setRecording(false);
  }

  function handleCancel() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRef.current?.state === 'recording') {
      mediaRef.current.ondataavailable = null;
      mediaRef.current.onstop = null;
      mediaRef.current.stop();
    }
    onCancel();
  }

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5">
      {/* Pulsating dot */}
      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shrink-0" />

      {/* Timer */}
      <span className="text-red-700 font-mono text-sm font-semibold">{fmt(seconds)}</span>
      <span className="text-red-500 text-xs flex-1">Yozmoqda...</span>

      {/* Wave bars */}
      <div className="flex items-end gap-0.5 h-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="w-1 bg-red-400 rounded-full animate-bounce"
            style={{ height: `${Math.random() * 16 + 8}px`, animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>

      {/* Bekor */}
      <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 text-sm px-1 transition-colors"><X size={16} /></button>

      {/* Yuborish */}
      <button
        onClick={handleStop}
        className="bg-red-500 text-white text-xs font-medium px-3 py-1.5 rounded-xl hover:bg-red-600 transition-colors"
      >
        Yuborish
      </button>
    </div>
  );
}
