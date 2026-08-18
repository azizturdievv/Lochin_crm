// 8 ta fan + super admin seed scripti — `npm run seed` buyrug'i bilan ishga tushiriladi
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Subject } from '../entities/subject.entity';
import { User } from '../entities/user.entity';
import { Session } from '../entities/session.entity';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { Room } from '../entities/room.entity';
import { ScheduleTimeSlot } from '../entities/schedule-time-slot.entity';
import { Role } from '../common/enums/role.enum';
import * as dotenv from 'dotenv';

dotenv.config();

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  database: process.env.DB_NAME ?? 'ilm_crm',
  username: process.env.DB_USER ?? 'admin',
  password: process.env.DB_PASS ?? 'secret123',
  entities: [Subject, User, Session, Permission, RolePermission, Room, ScheduleTimeSlot],
  synchronize: false,
});

const SUPER_ADMIN_EMAIL = 'admin@lochin.uz';
const SUPER_ADMIN_PASSWORD = 'Admin123!';

const SUBJECTS = [
  { name: 'Ingliz tili',   description: 'Xorijiy til — ingliz tili kursi',  sortOrder: 1 },
  { name: 'Matematika',    description: 'Algebra, geometriya va analiz',     sortOrder: 2 },
  { name: 'Rus tili',      description: 'Xorijiy til — rus tili kursi',      sortOrder: 3 },
  { name: 'Informatika',   description: 'Dasturlash va kompyuter savodxonligi', sortOrder: 4 },
  { name: 'Fizika',        description: 'Umumiy fizika kursi',               sortOrder: 5 },
  { name: 'Kimyo',         description: 'Umumiy kimyo kursi',                sortOrder: 6 },
  { name: 'Biologiya',     description: 'Umumiy biologiya kursi',            sortOrder: 7 },
  { name: 'Tarix',         description: 'O\'zbekiston va jahon tarixi',      sortOrder: 8 },
];

async function seedSubjects() {
  const repo = ds.getRepository(Subject);

  let added = 0;
  let skipped = 0;

  for (const s of SUBJECTS) {
    const existing = await repo.findOne({ where: { name: s.name } });
    if (existing) {
      console.log(`⏭  Mavjud: ${s.name}`);
      skipped++;
      continue;
    }
    const subject = repo.create({ ...s, isActive: true });
    await repo.save(subject);
    console.log(`✅ Qo'shildi: ${s.name}`);
    added++;
  }

  console.log(`\nFanlar: ${added} ta qo'shildi, ${skipped} ta o'tkazib yuborildi.`);
}

async function seedSuperAdmin() {
  const repo = ds.getRepository(User);

  const existing = await repo.findOne({ where: { email: SUPER_ADMIN_EMAIL } });
  if (existing) {
    console.log(`⏭  Super admin mavjud: ${SUPER_ADMIN_EMAIL}`);
    return;
  }

  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
  const admin = repo.create({
    firstName: 'Super',
    lastName: 'Admin',
    email: SUPER_ADMIN_EMAIL,
    username: 'admin',
    passwordHash,
    role: Role.SUPER_ADMIN,
    isActive: true,
  });
  await repo.save(admin);
  console.log(`✅ Super admin yaratildi: ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD}`);
  console.log('⚠️  Birinchi kirishdan so\'ng parolni almashtiring!');
}

// ─── RUXSATLAR MATRITSASI ────────────────────────────────────────────────────
const PERMISSIONS: Array<{ action: string; module: string; displayName: string }> = [
  { action: 'student:profile:read',        module: 'student',      displayName: "O'quvchi profilini ko'rish" },
  { action: 'student:profile:write',       module: 'student',      displayName: "O'quvchi profilini tahrirlash" },
  { action: 'student:progress:read',       module: 'student',      displayName: "O'quvchi o'sishini ko'rish" },
  { action: 'payment:payment:create',      module: 'payment',      displayName: "To'lov qabul qilish" },
  { action: 'payment:payment:read',        module: 'payment',      displayName: "To'lovlar ro'yxatini ko'rish" },
  { action: 'payment:debtor:read',         module: 'payment',      displayName: 'Qarzdorlar ro\'yxatini ko\'rish' },
  { action: 'attendance:qr:scan',          module: 'attendance',   displayName: 'QR orqali davomat belgilash' },
  { action: 'attendance:manual:mark',      module: 'attendance',   displayName: 'Qo\'lda davomat belgilash' },
  { action: 'attendance:report:read',      module: 'attendance',   displayName: 'Davomat hisobotini ko\'rish' },
  { action: 'schedule:lesson:read',        module: 'schedule',     displayName: 'Dars jadvalini ko\'rish' },
  { action: 'schedule:lesson:write',       module: 'schedule',     displayName: 'Dars jadvalini tahrirlash' },
  { action: 'lms:test:draft',              module: 'lms',          displayName: 'Test qoralamasini yaratish' },
  { action: 'lms:test:publish',            module: 'lms',          displayName: 'Testni nashr qilish' },
  { action: 'lms:result:read',             module: 'lms',          displayName: 'Test natijalarini ko\'rish' },
  { action: 'crm:lead:read',               module: 'crm',          displayName: 'Lidlarni ko\'rish' },
  { action: 'crm:lead:write',              module: 'crm',          displayName: 'Lidlarni tahrirlash' },
  { action: 'crm:lead:delete',             module: 'crm',          displayName: 'Lidni o\'chirish' },
  { action: 'finance:report:read',         module: 'finance',      displayName: 'Moliyaviy hisobotni ko\'rish' },
  { action: 'finance:salary:read',         module: 'finance',      displayName: 'Ish haqini ko\'rish' },
  { action: 'finance:salary:approve',      module: 'finance',      displayName: 'Ish haqini tasdiqlash' },
  { action: 'finance:expense:write',       module: 'finance',      displayName: 'Xarajat kiritish' },
  { action: 'chat:classroom:write',        module: 'chat',         displayName: 'Sinfxona chatga yozish' },
  { action: 'chat:monitor:read',           module: 'chat',         displayName: 'Barcha chatlarni kuzatish' },
  { action: 'gamification:points:write',   module: 'gamification', displayName: 'Ball qo\'shish/ayirish' },
  { action: 'gamification:badge:read',     module: 'gamification', displayName: 'Badge\'larni ko\'rish' },
  { action: 'events:event:write',          module: 'events',       displayName: 'Tadbir yaratish/tahrirlash' },
  { action: 'events:certificate:issue',    module: 'events',       displayName: 'Sertifikat chiqarish' },
  { action: 'quality:report:read:all',     module: 'quality',      displayName: 'Barcha xodimlar sifat hisobotini ko\'rish' },
  { action: 'quality:report:read:own',     module: 'quality',      displayName: 'O\'z sifat hisobotini ko\'rish' },
  { action: 'substitution:assign:write',   module: 'substitution', displayName: 'O\'rinbosar tayinlash' },
  { action: 'substitution:read',           module: 'substitution', displayName: 'O\'rinbosarlik ro\'yxatini ko\'rish' },
  { action: 'settings:permissions:manage', module: 'settings',     displayName: 'Ruxsatlar matritsasini boshqarish' },
];

// Manager/Ustoz/Student uchun standart grantlar (SA — barcha ruxsatlarni oladi, pastda alohida)
const ROLE_PERMISSIONS: Record<string, Role[]> = {
  'student:profile:read':        [Role.MANAGER, Role.USTOZ],
  'student:profile:write':       [Role.MANAGER],
  'student:progress:read':       [Role.MANAGER, Role.USTOZ, Role.STUDENT],
  'payment:payment:create':      [Role.MANAGER],
  'payment:payment:read':        [Role.MANAGER],
  'payment:debtor:read':         [Role.MANAGER, Role.USTOZ],
  'attendance:qr:scan':          [Role.MANAGER],
  'attendance:manual:mark':      [Role.MANAGER, Role.USTOZ],
  'attendance:report:read':      [Role.MANAGER, Role.USTOZ],
  'schedule:lesson:read':        [Role.MANAGER, Role.USTOZ, Role.STUDENT],
  'schedule:lesson:write':       [Role.MANAGER],
  'lms:test:draft':              [Role.MANAGER, Role.USTOZ],
  'lms:test:publish':            [Role.MANAGER],
  'lms:result:read':             [Role.MANAGER, Role.USTOZ, Role.STUDENT],
  'crm:lead:read':               [Role.MANAGER],
  'crm:lead:write':              [Role.MANAGER],
  'crm:lead:delete':             [],
  'finance:report:read':         [],
  'finance:salary:read':         [],
  'finance:salary:approve':      [],
  'finance:expense:write':       [Role.MANAGER],
  'chat:classroom:write':        [Role.MANAGER, Role.USTOZ, Role.STUDENT],
  'chat:monitor:read':           [],
  'gamification:points:write':   [Role.MANAGER, Role.USTOZ],
  'gamification:badge:read':     [Role.MANAGER, Role.USTOZ, Role.STUDENT],
  'events:event:write':          [Role.MANAGER],
  'events:certificate:issue':    [Role.MANAGER],
  'quality:report:read:all':     [],
  'quality:report:read:own':     [Role.MANAGER, Role.USTOZ, Role.STUDENT],
  'substitution:assign:write':   [Role.MANAGER],
  'substitution:read':           [Role.MANAGER, Role.USTOZ],
  'settings:permissions:manage': [],
};

async function seedPermissions() {
  const repo = ds.getRepository(Permission);

  let added = 0;
  let skipped = 0;

  for (const p of PERMISSIONS) {
    const existing = await repo.findOne({ where: { action: p.action } });
    if (existing) {
      skipped++;
      continue;
    }
    await repo.save(repo.create(p));
    added++;
  }

  console.log(`Ruxsatlar katalogi: ${added} ta qo'shildi, ${skipped} ta o'tkazib yuborildi.`);
}

async function seedRolePermissions() {
  const permRepo = ds.getRepository(Permission);
  const rpRepo = ds.getRepository(RolePermission);

  const allPermissions = await permRepo.find();
  let added = 0;
  let skipped = 0;

  for (const permission of allPermissions) {
    // SA — har doim barcha ruxsatlarga ega
    const roles = new Set<Role>([Role.SUPER_ADMIN, ...(ROLE_PERMISSIONS[permission.action] ?? [])]);

    for (const role of roles) {
      const existing = await rpRepo.findOne({ where: { role, permissionId: permission.id } });
      if (existing) {
        skipped++;
        continue;
      }
      await rpRepo.save(rpRepo.create({ role, permissionId: permission.id }));
      added++;
    }
  }

  console.log(`Rol-ruxsat bog'lanishi: ${added} ta qo'shildi, ${skipped} ta o'tkazib yuborildi.`);
}

// CLAUDE.md: 5 xona (4 ta x 12 o'rin, 1 ta x 32 o'rin)
const ROOMS_SEED = [
  { name: 'Xona 101', number: '101', capacity: 12, orderIndex: 1 },
  { name: 'Xona 102', number: '102', capacity: 12, orderIndex: 2 },
  { name: 'Xona 103', number: '103', capacity: 12, orderIndex: 3 },
  { name: 'Xona 104', number: '104', capacity: 12, orderIndex: 4 },
  { name: 'Katta zal 201', number: '201', capacity: 32, orderIndex: 5 },
];

// CLAUDE.md: 4 para
const TIME_SLOTS_SEED = [
  { name: '1-para', startTime: '08:00', endTime: '10:00', orderIndex: 1 },
  { name: '2-para', startTime: '10:05', endTime: '12:00', orderIndex: 2 },
  { name: '3-para', startTime: '14:00', endTime: '16:00', orderIndex: 3 },
  { name: '4-para', startTime: '16:05', endTime: '18:00', orderIndex: 4 },
];

async function seedRooms() {
  const repo = ds.getRepository(Room);
  let added = 0, skipped = 0;

  for (const r of ROOMS_SEED) {
    const existing = await repo.findOne({ where: { number: r.number } });
    if (existing) {
      console.log(`⏭  Xona mavjud: ${r.number}`);
      skipped++;
      continue;
    }
    await repo.save(repo.create({ ...r, isActive: true }));
    console.log(`✅ Xona qo'shildi: ${r.number} (${r.capacity} o'rin)`);
    added++;
  }

  console.log(`\nXonalar: ${added} ta qo'shildi, ${skipped} ta o'tkazib yuborildi.`);
}

async function seedTimeSlots() {
  const repo = ds.getRepository(ScheduleTimeSlot);
  let added = 0, skipped = 0;

  for (const s of TIME_SLOTS_SEED) {
    const existing = await repo.findOne({ where: { name: s.name } });
    if (existing) {
      console.log(`⏭  Para mavjud: ${s.name}`);
      skipped++;
      continue;
    }
    await repo.save(repo.create({ ...s, isActive: true }));
    console.log(`✅ Para qo'shildi: ${s.name} (${s.startTime}-${s.endTime})`);
    added++;
  }

  console.log(`\nParalar: ${added} ta qo'shildi, ${skipped} ta o'tkazib yuborildi.`);
}

async function seed() {
  await ds.initialize();
  await seedSubjects();
  await seedSuperAdmin();
  await seedPermissions();
  await seedRolePermissions();
  await seedRooms();
  await seedTimeSlots();
  await ds.destroy();
}

seed().catch((err) => {
  console.error('Seed xatosi:', err);
  process.exit(1);
});
