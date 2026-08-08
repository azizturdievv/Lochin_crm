'use client';

import { X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const MAX_SECONDS = 60;

interface Props {
  onRecorded: (blob: Blob, durationSeconds: number) => void;
  onCancel:   () => void;
}

export default function VideoCircleRecorder({ onRecorded, onCancel }: Props) {
  const [phase,    setPhase]   = useState<'preview' | 'recording' | 'stopping'>('preview');
  const [seconds,  setSeconds] = useState(0);
  const [error,    setError]   = useState('');
  const videoRef  = useRef<HTMLVideoElement>(null);
  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const secondsRef = useRef(0);

  useEffect(() => {
    cancelledRef.current = false;
    startPreview();
    return () => { cancelledRef.current = true; cleanup(); };
  }, []);

  async function startPreview() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      // Effect qayta ishga tushishi bilan (masalan React Strict Mode) eski
      // so'rov kechikib kelsa — endi keraksiz stream'ni to'xtatamiz, video
      // elementga bog'lamaymiz (aks holda .play() "interrupted" xatosi beradi)
      if (cancelledRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      setError('Kameraga ruxsat berilmadi');
    }
  }

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current = [];
    // Timeslice bermasdan .start() chaqiramiz — shunda MediaRecorder butun
    // yozuvni bitta yaxlit (to'g'ri yopilgan) WebM sifatida qaytaradi;
    // davriy bo'laklarga bo'lib yig'ish ba'zan konteynerni buzib qo'yardi
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      // `seconds` state'i eskirgan closure orqali 0 bo'lib qolardi —
      // shu bilan backend'ning 30-soniya minimal tekshiruvidan o'tmay,
      // yuklash "Video yuklanmadi" xatosi bilan yiqilardi
      onRecorded(blob, secondsRef.current);
      cleanup();
    };

    mr.start();
    mediaRef.current = mr;
    setPhase('recording');
    setSeconds(0);
    secondsRef.current = 0;

    timerRef.current = setInterval(() => {
      setSeconds(s => {
        const next = s + 1;
        secondsRef.current = next;
        if (next >= MAX_SECONDS) {
          stopRecording();
          return MAX_SECONDS;
        }
        return next;
      });
    }, 1000);
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRef.current?.state === 'recording') {
      setPhase('stopping');
      mediaRef.current.stop();
    }
  }

  const progress = (seconds / MAX_SECONDS) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        {/* Video doira */}
        <div className="relative">
          {/* Progress ring */}
          {phase === 'recording' && (
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="48" fill="none" stroke="#ef4444" strokeWidth="3"
                strokeDasharray={`${progress * 3.016} ${301.6}`} className="transition-all" />
            </svg>
          )}
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-56 h-56 rounded-full object-cover border-4 border-white/30"
            style={{ transform: 'scaleX(-1)' }}
          />
          {phase === 'recording' && (
            <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-mono">
              {MAX_SECONDS - seconds}s
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Boshqaruv tugmalari */}
        <div className="flex items-center gap-4">
          <button onClick={() => { cleanup(); onCancel(); }}
            className="w-12 h-12 rounded-full bg-gray-600 text-white flex items-center justify-center text-xl hover:bg-gray-700 transition-colors"><X size={16} /></button>

          {phase === 'preview' && (
            <button onClick={startRecording}
              className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center text-2xl hover:bg-red-600 transition-colors shadow-lg">
              ⏺
            </button>
          )}

          {phase === 'recording' && (
            <button onClick={stopRecording}
              className="w-16 h-16 rounded-full bg-white text-red-500 flex items-center justify-center text-2xl hover:bg-gray-100 transition-colors shadow-lg">
              ⏹
            </button>
          )}

          {phase === 'stopping' && (
            <div className="w-16 h-16 rounded-full bg-gray-400 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <p className="text-white/60 text-xs">
          {phase === 'preview' ? '⏺ Bosish orqali yozishni boshlang' :
           phase === 'recording' ? `${seconds}s / ${MAX_SECONDS}s` : 'Ishlanmoqda...'}
        </p>
      </div>
    </div>
  );
}
