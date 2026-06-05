'use client';

import Image from 'next/image';
import type { ChatMessage } from '@/types/chat';

interface Props {
  message:  ChatMessage;
  isOwn:    boolean;
  onDelete: (messageId: string) => void;
  showName: boolean;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

function ReadStatus({ readBy, isOwn }: { readBy: string[]; isOwn: boolean }) {
  if (!isOwn) return null;
  const read = readBy.length > 0;
  return (
    <span className={`text-[10px] ml-1 ${read ? 'text-blue-500' : 'text-gray-400'}`}>
      {read ? '✓✓' : '✓'}
    </span>
  );
}

export default function MessageBubble({ message, isOwn, onDelete, showName }: Props) {
  if (message.isDeleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
        <div className="bg-gray-100 rounded-2xl px-3 py-2 text-xs text-gray-400 italic max-w-xs">
          🗑️ Xabar o'chirildi
        </div>
      </div>
    );
  }

  // AI bloklangan
  if (message.moderationFlag === 'blocked') {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
        <div className="bg-red-100 border border-red-200 rounded-2xl px-3 py-2 text-xs text-red-600 max-w-xs">
          🚫 Bu xabar AI moderatsiya tomonidan bloklandi
        </div>
      </div>
    );
  }

  const isWarning = message.moderationFlag === 'warning';
  const bubbleCls = isOwn
    ? 'bg-emerald-600 text-white rounded-br-sm'
    : isWarning
    ? 'bg-amber-50 border border-amber-300 text-gray-900 rounded-bl-sm'
    : 'bg-white border border-gray-100 shadow-sm text-gray-900 rounded-bl-sm';

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1 group`}>
      <div className="max-w-[72%]">
        {/* Yuboruvchi ismi (boshqalar uchun) */}
        {!isOwn && showName && message.sender && (
          <p className="text-[10px] text-gray-400 ml-3 mb-0.5">
            {message.sender.firstName} {message.sender.lastName}
          </p>
        )}

        <div className={`rounded-2xl px-3 py-2 relative ${bubbleCls}`}>
          {isWarning && (
            <p className="text-[9px] text-amber-600 mb-1">⚠️ Imlo xatolari aniqlandi</p>
          )}

          {/* Xabar turi bo'yicha kontent */}
          <MessageContent message={message} isOwn={isOwn} />

          {/* Vaqt va o'qildi */}
          <div className={`flex items-center justify-end gap-0.5 mt-0.5 ${isOwn ? 'text-emerald-100' : 'text-gray-400'}`}>
            <span className="text-[10px]">{formatTime(message.createdAt)}</span>
            <ReadStatus readBy={message.readBy} isOwn={isOwn} />
            {message.spellingErrors > 0 && (
              <span className="text-[9px] ml-1 opacity-70">✍️{message.spellingErrors}</span>
            )}
          </div>
        </div>

        {/* O'chirish (hover, faqat o'z xabarlari) */}
        {isOwn && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end mt-0.5">
            <button
              onClick={() => onDelete(message.id)}
              className="text-[10px] text-gray-400 hover:text-red-500 transition-colors px-1"
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageContent({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  const textCls = isOwn ? 'text-white' : 'text-gray-900';

  switch (message.type) {
    case 'text':
      return <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${textCls}`}>{message.content}</p>;

    case 'image':
    case 'lesson_photo':
      return (
        <div className="space-y-1">
          {message.fileUrl && (
            <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
              <Image
                src={message.fileUrl}
                alt="Rasm"
                width={240}
                height={180}
                className="rounded-xl object-cover max-w-full"
                unoptimized
              />
            </a>
          )}
          {message.content && <p className={`text-xs mt-1 ${textCls}`}>{message.content}</p>}
        </div>
      );

    case 'audio':
      return (
        <div className="flex items-center gap-2 min-w-[160px]">
          <span className="text-lg">🎵</span>
          {message.fileUrl ? (
            <audio controls src={message.fileUrl} className="h-8 max-w-[180px]" />
          ) : (
            <span className={`text-xs ${textCls}`}>Audio fayl</span>
          )}
          {message.durationSeconds && (
            <span className={`text-xs opacity-70 ${textCls}`}>{message.durationSeconds}s</span>
          )}
        </div>
      );

    case 'video_circle':
      return (
        <div className="space-y-1">
          <div className="text-xs opacity-70 mb-1">{isOwn ? 'text-emerald-100' : 'text-gray-400'} 🎥 Video doira</div>
          {message.fileUrl ? (
            <video
              src={message.fileUrl}
              controls
              className="w-44 h-44 rounded-full object-cover border-4 border-white/30"
            />
          ) : (
            <div className="w-44 h-44 rounded-full bg-black/20 flex items-center justify-center text-2xl">🎥</div>
          )}
          {message.durationSeconds && (
            <span className={`text-[10px] opacity-70 ${textCls}`}>{message.durationSeconds}s</span>
          )}
        </div>
      );

    case 'video':
      return (
        <div>
          {message.fileUrl ? (
            <video src={message.fileUrl} controls className="max-w-xs rounded-xl" />
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-lg">🎬</span>
              <span className={`text-xs ${textCls}`}>Video</span>
            </div>
          )}
        </div>
      );

    case 'file':
      return (
        <div className="flex items-center gap-2">
          <div className={`text-2xl`}>📎</div>
          <div>
            {message.fileUrl ? (
              <a
                href={message.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-sm underline underline-offset-2 ${isOwn ? 'text-emerald-100' : 'text-blue-600'}`}
              >
                {message.content ?? 'Fayl'}
              </a>
            ) : (
              <span className={`text-sm ${textCls}`}>{message.content ?? 'Fayl'}</span>
            )}
            {message.fileSize && (
              <p className={`text-[10px] opacity-70 ${textCls}`}>
                {(message.fileSize / 1024).toFixed(0)} KB
              </p>
            )}
          </div>
        </div>
      );

    default:
      return <p className={`text-sm ${textCls}`}>{message.content}</p>;
  }
}
