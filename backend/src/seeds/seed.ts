// 8 ta fan seed scripti — `npm run seed` buyrug'i bilan ishga tushiriladi
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Subject } from '../entities/subject.entity';
import * as dotenv from 'dotenv';

dotenv.config();

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  database: process.env.DB_NAME ?? 'ilm_crm',
  username: process.env.DB_USER ?? 'admin',
  password: process.env.DB_PASS ?? 'secret123',
  entities: [Subject],
  synchronize: false,
});

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

async function seed() {
  await ds.initialize();
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

  console.log(`\nNatija: ${added} ta qo'shildi, ${skipped} ta o'tkazib yuborildi.`);
  await ds.destroy();
}

seed().catch((err) => {
  console.error('Seed xatosi:', err);
  process.exit(1);
});
