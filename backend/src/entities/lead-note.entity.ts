import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Lead } from './lead.entity';
import { User } from './user.entity';

@Entity('lead_notes')
export class LeadNote extends BaseEntity {
  @ManyToOne(() => Lead, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  @Column({ name: 'lead_id' })
  leadId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'created_by' })
  createdById: string;

  @Column({ type: 'text' })
  content: string;

  // Stage o'zgarishi logi
  @Column({ name: 'stage_from', type: 'varchar', nullable: true })
  stageFrom: string | null;

  @Column({ name: 'stage_to', type: 'varchar', nullable: true })
  stageTo: string | null;
}
