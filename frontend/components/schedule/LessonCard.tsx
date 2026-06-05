'use client';

import { subjectColor, STATUS_COLORS } from '@/types/schedule';
import type { ScheduleLesson } from '@/types/schedule';

interface Props {
  lesson:        ScheduleLesson;
  dragging:      boolean;
  onDragStart:   (e: React.DragEvent, lesson: ScheduleLesson) => void;
  onDragEnd:     () => void;
  onClick:       () => void;
  onTeacherClick:(lesson: ScheduleLesson) => void;
  compact?:      boolean;
}

export default function LessonCard({
  lesson, dragging, onDragStart, onDragEnd, onClick, onTeacherClick, compact = false,
}: Props) {
  const subCls   = subjectColor(lesson.group.subject.id);
  const statusCl = STATUS_COLORS[lesson.status];
  const fillPct  = Math.round((lesson.group.currentStudents / lesson.group.maxStudents) * 100);

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, lesson)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`
        rounded-xl border cursor-grab active:cursor-grabbing select-none
        transition-all hover:shadow-md group relative
        ${subCls}
        ${dragging ? 'opacity-40 scale-95 shadow-inner' : 'hover:scale-[1.02]'}
        ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}
      `}
    >
      {/* Status dot */}
      {lesson.status !== 'scheduled' && (
        <div className="absolute top-1.5 right-1.5">
          <span className={`text-xs ${statusCl.text}`}>
            {lesson.status === 'substituted' ? '🔄' : lesson.status === 'completed' ? '✅' : '🚫'}
          </span>
        </div>
      )}

      {/* Guruh va fan */}
      <p className="font-semibold leading-tight truncate pr-4">
        {lesson.group.name}
      </p>
      <p className={`opacity-75 truncate ${compact ? 'text-[10px]' : 'text-xs mt-0.5'}`}>
        {lesson.group.subject.name}
      </p>

      {/* Ustoz — bosish → o'rinbosar */}
      {!compact && (
        <button
          onClick={e => { e.stopPropagation(); onTeacherClick(lesson); }}
          className="text-xs mt-1.5 opacity-70 hover:opacity-100 transition-opacity underline-offset-2 hover:underline text-left truncate w-full"
          title="O'rinbosar tayinlash"
        >
          👤 {lesson.teacher.lastName} {lesson.teacher.firstName[0]}.
        </button>
      )}

      {/* O'quvchilar to'ldirilganligi */}
      {!compact && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="flex-1 h-1 bg-black/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${fillPct >= 90 ? 'bg-red-400' : 'bg-current opacity-30'}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <span className="text-[10px] opacity-60 shrink-0">
            {lesson.group.currentStudents}/{lesson.group.maxStudents}
          </span>
        </div>
      )}
    </div>
  );
}
