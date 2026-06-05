export type RoomType    = 'group_class' | 'private' | 'announcements' | 'parent_teacher';
export type MessageType = 'text' | 'audio' | 'video' | 'video_circle' | 'file' | 'image' | 'lesson_photo';
export type ModerationFlag = 'blocked' | 'warning' | null;

export interface ChatRoom {
  id:           string;
  name:         string | null;
  type:         RoomType;
  groupId:      string | null;
  group?:       { id: string; name: string; subject?: { name: string } } | null;
  members?:     RoomMember[];
  unreadCount?: number;
  lastMessage?: ChatMessage | null;
  createdAt:    string;
}

export interface RoomMember {
  id:        string;
  firstName: string;
  lastName:  string;
  role:      string;
  avatarUrl: string | null;
  isOnline?: boolean;
}

export interface ChatMessage {
  id:             string;
  roomId:         string;
  senderId:       string;
  sender?:        { id: string; firstName: string; lastName: string; role: string; avatarUrl?: string | null };
  type:           MessageType;
  content:        string | null;
  fileUrl:        string | null;
  fileSize:       number | null;
  durationSeconds:number | null;
  spellingErrors: number;
  moderationFlag: ModerationFlag;
  isDeleted:      boolean;
  readBy:         string[];
  createdAt:      string;
}

export interface TypingUser {
  userId:    string;
  userName:  string;
  roomId:    string;
}

// Xona turi meta
export const ROOM_META: Record<RoomType, { icon: string; label: string; color: string }> = {
  group_class:    { icon: '🏫', label: 'Sinfxona',      color: 'text-blue-600'   },
  private:        { icon: '👤', label: 'Shaxsiy',        color: 'text-emerald-600'},
  announcements:  { icon: '📢', label: "E'lonlar",       color: 'text-purple-600' },
  parent_teacher: { icon: '👪', label: 'Ota-ona / Ustoz',color: 'text-amber-600'  },
};

// Foydalanuvchi uchun "faqat o'qish" xonalari
export function isReadOnly(roomType: RoomType, userRole: string): boolean {
  if (roomType === 'announcements' && userRole !== 'super_admin' && userRole !== 'manager') return true;
  return false;
}
