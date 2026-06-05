'use client';

import { useState, useRef, useCallback } from 'react';
import api from '@/lib/api';
import AudioRecorder from './AudioRecorder';
import VideoCircleRecorder from './VideoCircleRecorder';

interface Props {
  roomId:    string;
  readOnly:  boolean;
  onSend:    (payload: object) => void;
  onTyping:  () => void;
  onStop:    () => void;
}

type MediaMode = 'none' | 'audio' | 'video_circle';

export default function MessageInput({ roomId, readOnly, onSend, onTyping, onStop }: Props) {
  const [text,       setText]      = useState('');
  const [mode,       setMode]      = useState<MediaMode>('none');
  const [uploading,  setUploading] = useState(false);
  const [dragOver,   setDragOver]  = useState(false);
  const [toast,      setToast]     = useState<string | null>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const typingTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    onTyping();
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(onStop, 2000);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  }

  function sendText() {
    const t = text.trim();
    if (!t) return;
    onSend({ roomId, type: 'text', content: t });
    setText('');
    onStop();
  }

  async function uploadAndSend(file: File, endpoint: string, messageType: string) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res  = await api.post<{ url: string; size?: number }>(endpoint, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSend({
        roomId,
        type:     messageType,
        fileUrl:  res.data.url,
        fileSize: res.data.size ?? file.size,
        content:  file.name,
      });
    } catch {
      showToast('Yuklashda xatolik yuz berdi');
    } finally {
      setUploading(false);
    }
  }

  async function handleAudioRecorded(blob: Blob, dur: number) {
    setMode('none');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', blob, `audio-${Date.now()}.webm`);
      const res  = await api.post<{ url: string }>('/chat/upload/audio', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSend({ roomId, type: 'audio', fileUrl: res.data.url, durationSeconds: dur });
    } catch {
      showToast('Audio yuklanmadi');
    } finally {
      setUploading(false);
    }
  }

  async function handleVideoRecorded(blob: Blob, dur: number) {
    setMode('none');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', blob, `video-circle-${Date.now()}.webm`);
      const res  = await api.post<{ url: string }>('/chat/upload/video-circle', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSend({ roomId, type: 'video_circle', fileUrl: res.data.url, durationSeconds: dur });
    } catch {
      showToast('Video yuklanmadi');
    } finally {
      setUploading(false);
    }
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;

    for (const file of files.slice(0, 5)) {
      const isImg = file.type.startsWith('image/');
      const ep    = isImg ? '/chat/upload/image' : '/chat/upload/file';
      const type  = isImg ? 'image' : 'file';
      await uploadAndSend(file, ep, type);
    }
  }, [roomId]);

  if (readOnly) {
    return (
      <div className="flex items-center justify-center h-14 bg-gray-50 border-t border-gray-100">
        <p className="text-sm text-gray-400">📢 Bu kanalda faqat o'qish mumkin</p>
      </div>
    );
  }

  return (
    <div
      className={`border-t border-gray-100 transition-colors ${dragOver ? 'bg-emerald-50' : 'bg-white'}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-emerald-50/90 pointer-events-none">
          <div className="text-center">
            <div className="text-4xl mb-2">📎</div>
            <p className="text-emerald-700 font-medium">Faylni tashlang</p>
          </div>
        </div>
      )}

      {/* Audio yozuv rejimi */}
      {mode === 'audio' && (
        <div className="px-4 py-2">
          <AudioRecorder
            onRecorded={handleAudioRecorded}
            onCancel={() => setMode('none')}
          />
        </div>
      )}

      {/* Video doira rejimi */}
      {mode === 'video_circle' && (
        <VideoCircleRecorder
          onRecorded={handleVideoRecorded}
          onCancel={() => setMode('none')}
        />
      )}

      {/* Asosiy input */}
      {mode === 'none' && (
        <div className="flex items-end gap-2 px-4 py-3">
          {/* Media tugmalari */}
          <div className="flex items-center gap-1 shrink-0">
            <MediaBtn icon="🖼️" title="Rasm yuborish" onClick={() => imageInputRef.current?.click()} />
            <MediaBtn icon="📎" title="Fayl yuborish" onClick={() => fileInputRef.current?.click()} />
            <MediaBtn icon="🎤" title="Audio yozish"  onClick={() => setMode('audio')} />
            <MediaBtn icon="🎥" title="Video doira"   onClick={() => setMode('video_circle')} />
          </div>

          {/* Matn kiritish */}
          <div className="flex-1 relative">
            <textarea
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Xabar yozing... (Enter = yuborish, Shift+Enter = yangi qator)"
              rows={1}
              className="w-full resize-none bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent max-h-32 overflow-y-auto"
              style={{ minHeight: '42px' }}
            />
          </div>

          {/* Yuborish */}
          <button
            onClick={sendText}
            disabled={!text.trim() || uploading}
            className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {uploading
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : '➤'}
          </button>
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" multiple
        onChange={e => { Array.from(e.target.files ?? []).forEach(f => uploadAndSend(f, '/chat/upload/image', 'image')); e.target.value = ''; }} />
      <input ref={fileInputRef} type="file" className="hidden" multiple
        onChange={e => { Array.from(e.target.files ?? []).forEach(f => uploadAndSend(f, '/chat/upload/file', 'file')); e.target.value = ''; }} />

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-4 py-2 rounded-xl shadow-lg z-20">
          {toast}
        </div>
      )}
    </div>
  );
}

function MediaBtn({ icon, title, onClick }: { icon: string; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title}
      className="w-9 h-9 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center text-base transition-colors">
      {icon}
    </button>
  );
}
