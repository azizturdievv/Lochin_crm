# Ilm Academy CRM — Backend Kod Auditi

**Sana:** 2026-07-28
**Qamrov:** `backend/` — 201 TS fayl, 49 entity, 19 modul, 233 API endpoint
**Usul:** Statik tahlil + bog'liqliklar validatsiyasi (npm registry). Kompilyatsiya va runtime tekshirilmadi — quyidagi "Tekshirish buyruqlari" bo'limiga qarang.

---

## Umumiy xulosa

Kod **skeleton emas — jiddiy, ishlangan loyiha**. CLAUDE.md'dagi 14+1 modulning deyarli barchasi real biznes mantiq bilan yozilgan. **0dan qayta yozish tavsiya etilmaydi** — mavjud kodni tuzatib, kamchiliklarni to'ldirish ancha tez va arzon.

Lekin loyiha **hech qachon ishga tushirilmaganga o'xshaydi** (node_modules yo'q, super admin seed yo'q) va bir nechta **kritik xavfsizlik kamchiliklari** bor.

---

## Kuchli tomonlar

| Soha | Holat |
|------|-------|
| Modullar | 19 modul to'liq ulangan (auth, students, payments, attendance, LMS, leads, finance, chat, gamification, events, quality, substitution...) |
| Biznes qoidalar | Haqiqiy implementatsiya: QR (HMAC-SHA256 imzo + 24h cron yangilash), D+15 cron, lid 15-daqiqa qoidasi, baseline muhrlash, test zanjiri (draft→review→published, rol tekshiruvli), kassa smena farqi → SA alert, o'rinbosarlik maosh formulasi (BigInt + transaction) |
| Xavfsizlik asoslari | bcrypt(12), brute-force (5 xato → 30 daq blok), TOTP 2FA, qurilma bo'yicha sessiyalar, keng audit logging |
| Tranzaksiyalar | payments, students, substitution, competition'da to'g'ri qo'llangan |
| Testlar | 11 spec fayl (substitution, finance, notifications, lms) |
| Bog'liqliklar | package.json versiyalari to'g'ri, o'rnatiladi (TypeORM 1.1.0, class-validator 0.15.1 — tekshirildi) |

---

## Kamchiliklar

### P0 — Blokerlar (ishga tushmaydi / darhol kerak)

1. **Super admin seed yo'q.** Seed faqat 8 ta fanni kiritadi. Foydalanuvchi jadval bo'sh — tizimga birinchi kirishning iloji yo'q.
2. **`.env`da `JWT_EXPIRES_IN=24h`** — CLAUDE.md talabi 15 daqiqa. Kod default'i to'g'ri (15m), lekin .env uni bekor qiladi.
3. **Rate limiting umuman yo'q.** CLAUDE.md: 100 so'rov/daq/IP. `@nestjs/throttler` o'rnatilmagan ham.
4. **Migratsiyalar yo'q.** Faqat `synchronize: true` (dev). Production'da sxema yaratishning mexanizmi yo'q.
5. **Loyiha hech qachon build/test qilinmagan** (node_modules yo'q) — kompilyatsiya xatolari bo'lishi mumkin.

### P1 — Xavfsizlik

6. **AES-256 shifrlash implementatsiya qilinmagan.** `.env`da kalit bor, `crypto-js` o'rnatilgan, lekin kodda ishlatilmagan — ish haqi va shaxsiy ma'lumotlar ochiq saqlanadi. (salary.entity.ts'dagi izoh yolg'on va'da.)
7. **Refresh token DB'da ochiq (plaintext) saqlanadi** va rotation yo'q — DB sizib chiqsa, barcha sessiyalar ochiladi. Hash qilib saqlash kerak.
8. **2FA "majburiy"ligi enforced emas.** SA/Manager 2FA sozlamagan bo'lsa, 2FA'siz kiraveradi. Birinchi kirishda majburiy setup bo'lishi kerak.
9. **SMS 2FA yo'lagi yo'q** — login `'sms'` turini qaytaradi, lekin verify2fa faqat TOTP tekshiradi.
10. **Audit log faqat ilova darajasida himoyalangan.** DB darajasida UPDATE/DELETE taqiqi (trigger yoki REVOKE) yo'q; 5 yillik retention siyosati faqat izohda.
11. **`secret123` default fallback** kod ichida (database.config.ts, seed.ts) — prod'da .env bo'lmasa jim ishlayveradi.

### P2 — To'liqlik va sifat

12. **Redis ishlatilmagan** — docker-compose va deps'da bor, kodda birorta ham murojaat yo'q (kesh/sessiya talabi bajarilmagan).
13. **Swagger yo'q** — 233 endpoint hujjatsiz. `@nestjs/swagger` deps'da ham yo'q.
14. **`user_role_permissions` jadvali yo'q** — RBAC faqat 4 ta enum rol darajasida, granular ruxsatlar matritsasi yo'q.
15. **Jonli video (Livekit/Daily.co) integratsiyasi yo'q** — faqat entity ustuni. Chat WebSocket bor, video yo'q.
16. **docker-compose:** MinIO'da volume yo'q (restart'da fayllar o'chadi), backend service va nginx yo'q.
17. **tsconfig: `noImplicitAny: false`** + kodda 51 ta `: any` — CLAUDE.md'ning "any ishlatma" qoidasiga zid.
18. **Kirill-lotin aralash satrlar:** masalan `'muhrlanган'` (baseline.service.ts) — foydalanuvchiga ko'rinadigan xato matnlar.
19. 3 ta TODO: leaderboard homework hissasi, muddatli to'lov eslatmasi.
20. ~~Frontend boshlanmagan~~ **Tuzatish:** `frontend/` mavjud — Next.js admin panel, 22 sahifa (login + dashboard bo'limlari: students, payments, finance, attendance, schedule, leads, LMS, chat, gamification, events, substitutions, quality, staff, groups, settings, profile). Sifati alohida audit talab qiladi. 3 ta mobil ilova (React Native) boshlanmagan.

21. **Disk hajmi:** `frontend/.next` (Turbopack dev keshi, ~1,5 GB gacha) va `backend/dist` repo'da yotibdi — o'chirish xavfsiz, `.gitignore`da bor, lekin diskni band qiladi: `rm -rf frontend/.next backend/dist frontend/tsconfig.tsbuildinfo`

---

## Tavsiya etilgan reja

**1-bosqich (ishga tushirish):** npm install → build xatolarini tuzatish → super admin seed → .env tuzatish (JWT 15m) → docker-compose bilan ko'tarish → asosiy oqimlarni qo'lda tekshirish.

**2-bosqich (xavfsizlik):** throttler, refresh token hash + rotation, 2FA majburiylik, AES-256 transformer, audit log DB trigger, migratsiyalarga o'tish.

**3-bosqich (to'ldirish):** Swagger, Redis kesh, SMS 2FA, MinIO volume, TODO'lar, `any` tozalash, aralash-alifbo satrlar.

**4-bosqich:** Frontend (Next.js admin panel) → mobil ilovalar → jonli video integratsiya.

---

## Tekshirish buyruqlari (lokal)

```bash
docker compose up -d
cd backend
npm install
npm run build        # kompilyatsiya xatolari shu yerda chiqadi
npm run test         # 11 spec fayl
npm run seed         # hozircha faqat fanlar
npm run start:dev
```
