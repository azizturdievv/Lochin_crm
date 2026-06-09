import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('schedule_time_slots')
export class ScheduleTimeSlot extends BaseEntity {
  // Para nomi (masalan: "1-para")
  @Column({ type: 'varchar' })
  name: string;

  // Boshlanish vaqti (masalan: "08:00")
  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  // Tugash vaqti (masalan: "10:00")
  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  // Faollik holati
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Tartib raqami (jadvalda ketma-ket ko'rsatish uchun)
  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;
}
