'use client';

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

  useEffect(() => {
    startPreview();
    return () => cleanup();
  }, []);

  async function startPreview() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
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
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      onRecorded(blob, seconds);
      cleanup();
    };

    mr.start(100);
    mediaRef.current = mr;
    setPhase('recording');
    setSeconds(0);

    timerRef.current = setInterval(() => {
      setSeconds(s => {
        if (s + 1 >= MAX_SECONDS) {
          stopRecording();
          return MAX_SECONDS;
        }
        return s + 1;
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
            className="w-12 h-12 rounded-full bg-gray-600 text-white flex items-center justify-center text-xl hover:bg-gray-700 transition-colors">
            ✕
          </button>

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
           phase === 'recording' ? `🔴 ${seconds}s / ${MAX_SECONDS}s` : 'Ishlanmoqda...'}
        </p>
      </div>
    </div>
  );
}
