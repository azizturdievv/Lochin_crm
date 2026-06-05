import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('badges')
@Index(['userId', 'badgeType'], { unique: true })
export class Badge extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  // Imlo ustasi, O'sish, 30 kunlik streak, Tezkor tuzatish
  @Column({ name: 'badge_type', length: 100 })
  badgeType: string;

  @Column({ name: 'badge_name', length: 200 })
  badgeName: string;

  @Column({ name: 'icon_url', type: 'varchar', nullable: true })
  iconUrl: string | null;

  @Column({ name: 'earned_at', type: 'timestamptz' })
  earnedAt: Date;
}
