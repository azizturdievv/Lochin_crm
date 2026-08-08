#  CRM — Claude Code Arxitektura Hujjati

## Loyiha haqida
O'quv markazi uchun to'liq CRM tizimi.
- 14 ta asosiy modul + O'rinbosarlik moduli
- 4 ta rol (RBAC)
- 60+ funksiya
- 8 ta AI integratsiya
- 25+ ma'lumotlar bazasi jadvali

---

## Texnologiyalar steki

### Backend
- **Framework:** NestJS + TypeScript
- **API:** REST + WebSocket (Socket.io)
- **Ma'lumotlar bazasi:** PostgreSQL 16 (asosiy)
- **Kesh / Sessiya:** Redis 7
- **Fayl saqlash:** MinIO (local) → AWS S3 (production)
- **Auth:** JWT (Access: 15 daqiqa, Refresh: 30 kun) + 2FA (SMS / Google Authenticator)
- **Parol:** bcrypt (salt rounds: 12)
- **Shifrlash:** AES-256 (ish haqi, shaxsiy ma'lumotlar)
- **Video / Efir:** WebRTC — Livekit yoki Daily.co (200 gacha ishtirokchi)
- **AI:** OpenAI GPT-4o / Claude API
- **SMS:** Eskiz.uz yoki Playmobile (O'zbekiston)
- **Push:** Firebase Cloud Messaging
- **QR:** qrcode (dinamik, 24 soatda yangilanadi)
- **Termal printer:** POS printer integratsiyasi (kvitansiya)

### Frontend (Web)
- **Framework:** Next.js + TypeScript
- **Stil:** Tailwind CSS
- **State:** Zustand
- **Form:** React Hook Form + Zod
- **Chart:** Recharts
- **HTTP:** Axios + TanStack Query

### Mobile (3 ta ilova)
- **Texnologiya:** React Native (iOS + Android — bitta kod bazasi)
- **Admin ilova:** Yashil tema
- **O'quvchi ilova:** Sariq tema
- **Ustoz ilova:** Ko'k tema
- **Offline:** SQLite (QR davomat internet bo'lmasa ham ishlaydi)
- **Push:** Firebase Cloud Messaging

### Infratuzilma
- **Server:** Hetzner VPS — 4vCPU / 8GB RAM / 80GB SSD (~$28/oy)
- **CDN / Xavfsizlik:** Cloudflare (DDoS himoya, SSL, kesh)
- **SSL:** Let's Encrypt (bepul, avtomatik)
- **Proxy:** Nginx
- **Monitoring:** UptimeRobot (tushsa SA ga Telegram + SMS)
- **Backup (3-2-1):** Asosiy server + Zaxira server (~$8/oy) + Backblaze B2 (~$3/oy)

---

## Ma'lumotlar bazasi

### Ulanish
```
Host:     localhost:5432
DB:       ilm_crm
User:     admin
Password: secret123
Redis:    localhost:6379
MinIO:    localhost:9000 (console: 9001)
```

### Jadvallar (25+)

#### Foydalanuvchilar
```
users                  — barcha foydalanuvchilar
roles                  — rollar (super_admin, manager, ustoz, student)
sessions               — JWT sessiyalar (qurilma bo'yicha)
parents                — ota-onalar (student ga bog'liq)
user_role_permissions  — RBAC ruxsatlar
```

#### O'quv jarayon
```
subjects               — fanlar (8 ta, plugin arxitektura)
groups                 — guruhlar
enrollments            — o'quvchi-guruh bog'lanishi
lessons                — darslar
attendance             — davomat (QR asosida)
tests                  — testlar
test_questions         — test savollari (havzasi)
test_results           — natijalar
homework               — vazifalar
materials              — dars materiallari (PDF, video, audio)
```

#### Moliya
```
payments               — to'lovlar (naqd/karta/bank/Payme/Click/aralash)
installment_plans      — muddatli to'lov (2/3/4 qism)
expenses               — xarajatlar
salaries               — ish haqi (ustoz: 15-18% stavka + KPI bonus)
salary_records         — oylik maosh yozuvi
cash_sessions          — smena tizimi (kassirlar almashuvi)
products               — mini-market mahsulotlar
sales                  — savdolar
collection_events      — pul yig'imi (marosim)
contributions          — kim berdi/bermadi
```

#### Rag'bat va O'sish
```
points_log             — ball tarixi
badges                 — badge'lar (Imlo ustasi, O'sish, 30 kunlik streak...)
books                  — kitobxonlik (SA oylik 1-2 kitob)
book_tests             — kitob testlari (AI tomonidan)
baseline_assessments   — ilk qabul (muhrlanadi, o'zgartirib bo'lmaydi)
progress_snapshots     — o'sish grafigi ma'lumotlari
vocabulary_words       — lug'at moduli
```

#### Kommunikatsiya
```
chat_rooms             — sinfxona, shaxsiy, e'lonlar
messages               — xabarlar (matn, audio, video, fayl, rasm)
notifications          — bildirishnomalar
announcements          — e'lonlar
live_sessions          — WebRTC darslar (6 xona turi)
video_messages         — yumaloq video xabarlar (30-60 sek)
```

#### Boshqaruv
```
leads                  — lidlar (5 bosqich pipeline)
lead_notes             — lid izohlari
events                 — tadbirlar (olimpiada, sport, robototexnika...)
event_participants     — tadbir ishtirokchilari
audit_logs             — audit log (5 yil, o'chirimsiz)
duty_schedule          — navbat jadvali
certificates           — sertifikat / diplomlar
```

#### O'rinbosarlik
```
lesson_substitutions   — o'rinbosarlik (kim, qaysi dars, sabab, maosh)
teacher_absences       — o'qituvchi yo'qlik tarixi
```

---

## Foydalanuvchi rollari (RBAC)

### super_admin
- Barcha huquqlar
- Moliya, ish haqi, audit log
- AI muloqot tahlili
- Sifat nazorati (barcha ko'rinishi)
- Tizim sozlamalari, backup nazorat
- 2FA — MAJBURIY

### manager
- Kunlik operatsiyalar
- O'quvchilar, to'lov qabul, QR davomat
- Jadval, lid boshqaruvi, mini-market
- Test tasdiqlash, e'lonlar, tadbir boshqarish
- Sifat nazorati (faqat o'z ko'rinishi)
- 2FA — MAJBURIY

### ustoz
- Faqat o'z guruhi
- Material, vazifa, test draft
- Natija, sinfxona chat, video-xabar
- Dars suratlari, ota-ona bilan chat
- Ilk qabul baholash

### student / ota-ona
- **O'quvchi:** dars jadvali, materiallar, testlar, ball, to'lov, chat, portfolio, lug'at, referral
- **Ota-ona:** farzand progressi, ustoz bilan chat, sifat nazorati (farzand)

---

## 14 ta Modul

### 1. Smart Sales va Lid boshqaruvi
- Omnichannel Inbox: Instagram DM, Telegram, Qo'ng'iroq, Website, WhatsApp, Walk-in
- Pipeline (5 bosqich): Yangi → Suhbatda → Kutmoqda → Sinov darsi → O'quvchi / Yo'qotildi
- 15 daqiqa qoidasi: yangi lid 15 daqiqa ichida javob olishi — alert tizimi
- Konversiya foizi: admin bo'yicha va manba bo'yicha tahlil

### 2. QR Davomat tizimi
- Dinamik QR: 24 soatda avtomatik yangilanadi
- Holatlar: Keldi / Kech (daqiqa aniq) / Kelmadi / Sababsiz / Sababli
- D+15 qoida: kelmasa ota-onaga Telegram + CRM push
- Offline rejim: SQLite → internet tiklanishida sinxronizatsiya
- Ota-ona sabab kiritishi: online

### 3. LMS — Ko'p fanli o'quv tizimi
- 8 ta fan, plugin arxitektura (yangi fan — dasturchi kerak emas)
- Ilk qabul (Baseline): muhrlanadi, hatto SA ham o'zgartira olmaydi
- 3 darajali test: Oson (0-59%) / O'rta (60-79%) / Qiyin (80-100%)
- Random savollar: 30 dan 10 ta (3:5:2 nisbat), tasodifiy tartib
- Qayta urinish: eng yaxshi / o'rtacha / so'nggi ball (SA tanlaydi)
- Test zanjiri: Ustoz draft → Manager tekshirish → SA nashr
- AI anti-cheat: vaqt tahlili, guruh zaif tomonlari, ko'chirish aniqlash
- Vaqt uzaytirish so'rovi: o'quvchi so'raydi → ustoz bir bosishda tasdiqlaydi

### 4. Xona va Jadval boshqaruvi
- 5 xona: 4 ta x 12 o'rin, 1 ta x 32 o'rin
- 4 para: 08:00–10:00, 10:05–12:00, 14:00–16:00, 16:05–18:00
- 7 kunlik grid: Drag & drop, bo'sh slot tahlili, daromad tahlili

### 5. To'lov va Kassa tizimi
- To'lov usullari: Naqd, Karta, Bank, Payme, Click, Aralash
- Timestamp: sana + vaqt + oy + yil — kvitansiyada to'liq
- Muddatli to'lov: 2/3/4 qism — har qism alohida
- Naqd kupyura: 200K, 100K, 50K, 10K, 5K — kupyura bo'yicha sanoq
- Smena tizimi: kassirlar almashuvi, kassa farqi → SA alert
- Avtomatik eslatma: 1, 5, 10, 15, 30 kunlik SMS + Telegram + Push
- Pul yig'imi (marosim): hodisa, jadval, kim berdi/bermadi, eksport
- Termal printer: kvitansiya chop etish

### 6. Ombor va Mini-market (POS)
- QR / Barkod: mahsulot qo'shish, skanerlash, narx
- POS interfeys: savat, to'lov (naqd/karta), sessiya bo'yicha
- Parallel admin: bir vaqtda bir nechta admin
- Inventarizatsiya: qoldiq, marja, real daromad

### 7. SMS va Telegram Bot
- Provayderlar: Eskiz / Playmobile
- 8 ta trigger: davomat, to'lov eslatma, test natijasi, vazifa, jadval, e'lon, tug'ilgan kun, favqulodda
- Shablonlar: {{ism}}, {{summa}}, {{fan}}, {{sana}}
- Bot buyruqlari: /holat, /ball, /jadval, /tolov, /farzand, /hisobot

### 8. Moliyaviy hisobotlar
- KPI: daromad, xarajat, sof foyda, marja, o'quvchi soni, qarz
- P&L jadvali: oylik va yillik, fan bo'yicha tushum
- Ish haqi (faqat SA): ustoz 15-18% + KPI bonus; admin stavka + savdo bonusi
- Chorak mukofot: ball x koeffitsient formulasi
- Eksport: Excel, PDF, Telegram — bir tugmada

### 9. Mobil ilovalar (3 ta)
- Admin (yashil): QR skan, to'lov, market, hisobot
- O'quvchi (sariq): darslar, testlar, to'lov, chat, portfolio
- Ustoz (ko'k): guruh, material, test draft, video-xabar
- Offline: QR davomat SQLite
- Push: Firebase Cloud Messaging

### 10. CRM Ichki Sinfxona va Kommunikatsiya
- Kanallar: guruh sinfxonasi, shaxsiy chat, e'lonlar kanali
- Media: matn, audio, yumaloq video (Circle), fayl, rasm, dars suratlari
- AI moderatsiya: haqorat → avtomatik blok; shaxsiy ma'lumot → ogohlantirish
- Ota-ona ↔ Ustoz: to'g'ridan-to'g'ri chat (Telegram kerak emas)

### 11. Tadbirlar, Musobaqa va Sertifikat
- Turlar: olimpiada, sport, robototexnika, shaxmat, yugurish, madaniy
- Elektron ruxsatnoma: avtomatik generatsiya, QR verifikatsiya
- Onlayn musobaqa: random savollar, jonli natijalar, AI g'oliblarni aniqlaydi
- Sertifikat / Diplom: avtomatik PDF, CRM ilovaga yuborish

### 12. Jonli efir va Onlayn dars
- WebRTC: Livekit / Daily.co, 200 gacha ishtirokchi
- 6 xona turi: Ustoz-O'quvchi, Xodimlar, Ota-ona-Markaz, Musobaqa zali, Sport/Robo, Jonli efir
- Bildirishnomalar: belgilanganda, 1 soat oldin, 10 daqiqa oldin, yozuv tayyor
- O'quvchi video topshiriq: smartfondan → CRM sinfxona → ustoz baholaydi
- Yozuv arxivi: ota-ona ko'rishi mumkin

### 13. Rag'bat, Ball va Kitobxonlik
- Xodim ball: imlo xatosizlik (+2), kitob 80%+ (+50), navbat (+5), KPI 100% (+100), yangi o'quvchi (+30)
- Xodim jazo: imlo xatosi (-3), navbat bajarilmadi (-10)
- O'quvchi ball: xatosiz xabar (+3), xatoni o'zi tuzatsa (+5), kitob 80%+ (+50), test 90%+ (+20)
- O'quvchi mukofot: 1-o'rin kurs bepul, 2-o'rin 50% chegirma, 3-o'rin sovg'a
- Kitobxonlik: SA oylik 1-2 kitob, AI test, jonli muhokama
- Badge: Imlo ustasi, O'sish, 30 kunlik streak, Tezkor tuzatish
- Lug'at: yangi so'z, AI ta'rif, haftalik test, ball

### 14. Deployment va Xavfsizlik
- Stack: Cloudflare → Nginx → NestJS → PostgreSQL + Redis + MinIO
- Backup (3-2-1): asosiy + zaxira server + Backblaze B2 bulut
- JWT: Access 15 daqiqa, Refresh 30 kun, qurilma bo'yicha alohida
- 2FA: SA va Manager uchun majburiy (SMS yoki Google Authenticator)
- bcrypt: salt rounds 12, minimal 8 belgi
- AES-256: ish haqi va shaxsiy ma'lumotlar
- Brute force: 5 marta xato → 30 daqiqa blok → SA alert
- Rate limiting: 100 so'rov / daqiqa / IP
- Audit log: o'chirimsiz, 5 yil saqlanadi
- RBAC: har endpoint middleware bilan himoyalangan

### 15. O'rinbosarlik moduli
- Jarayon: Dars tanlash → O'rinbosar + sabab → Avtomatik maosh → Bildirishnoma → QR davomat
- Sabab turlari: sick, personal, family, training, other
- Maosh formulasi: dars_soat × stavka foizi (transaction ichida)
- O'rinbosar tayinlanganda: sub_amount += dars_soat × stavka
- Asosiy o'qituvchi: deduction += dars_soat × stavka

---

## API Endpointlar (asosiy)

```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/2fa/verify

GET    /api/v1/students
POST   /api/v1/students
GET    /api/v1/students/:id/progress

POST   /api/v1/payments
GET    /api/v1/payments/report
GET    /api/v1/payments/debtors

POST   /api/v1/attendance/qr-scan
GET    /api/v1/attendance/today
POST   /api/v1/attendance/offline-sync

GET    /api/v1/schedule/week
POST   /api/v1/schedule/lesson
PATCH  /api/v1/schedule/lesson/:id

POST   /api/v1/tests
GET    /api/v1/tests/:id/results
POST   /api/v1/tests/:id/submit

POST   /api/v1/leads
PATCH  /api/v1/leads/:id/stage
GET    /api/v1/leads/pipeline

GET    /api/v1/finance/pnl
GET    /api/v1/finance/salary
POST   /api/v1/finance/salary/approve

POST   /api/v1/substitutions
DELETE /api/v1/substitutions/:id
GET    /api/v1/substitutions/lesson/:lessonId

GET    /api/v1/reports/dashboard
GET    /api/v1/reports/export (Excel, PDF, Telegram)

POST   /api/v1/notifications/send
GET    /api/v1/audit-logs
```

---

## Xavfsizlik talablari

| Soha | Talab |
|------|-------|
| JWT | Access: 15 daqiqa, Refresh: 30 kun, qurilma bo'yicha alohida |
| 2FA | SA va Manager uchun MAJBURIY — SMS yoki Google Authenticator |
| Parol | bcrypt, salt: 12, minimal: 8 belgi |
| Shifrlash | AES-256 — ish haqi, shaxsiy ma'lumotlar |
| Transport | HTTPS / TLS — Let's Encrypt |
| Brute force | 5 marta xato → 30 daqiqa blok → SA alert |
| Rate limit | 100 so'rov / daqiqa / IP |
| Audit log | O'chirimsiz, 5 yil saqlanadi, SA ham o'zgartira olmaydi |
| RBAC | Har endpoint rol bo'yicha middleware tekshiruvi |

---

## Sifat nazorati (rol bo'yicha)

| Rol | Ko'rishi |
|-----|----------|
| super_admin | Barcha xodim imlo + o'quvchi o'sishi + AI muloqot tahlili |
| manager | O'z imlo xatolari, muloqot sifati, tizim tavsiyalari |
| ustoz | O'z imlo + guruh umumiy ko'rsatkichi |
| ota-ona | Farzand imlo xatolari + ustoz izohlari + o'sish grafigi |
| student | O'z imlo xatolari + to'g'ri variant + mashq + o'sish grafigi |

---

## Ilk qabul — Boshlang'ich nuqta

Muhrlanadi — hech kim o'zgartira olmaydi (hatto SA ham).

| Tur | Ma'lumot |
|-----|----------|
| Test | Ball 0-100, savollar, to'g'ri javoblar, vaqt |
| Og'zaki | Audio yozuv + mezonlar bo'yicha ball |
| Ijodiy (Rasm) | Fayl + ustoz bahosi + mezonlar |
| Sport | Yugurish vaqti (sek), sakrash (sm), jismoniy holat |
| Yangi yo'nalish | Admin o'zi qo'shadi — dasturchi kerak emas |

---

## Oylik texnik xarajat

| Xizmat | Narx |
|--------|------|
| Hetzner VPS (asosiy) | ~$28/oy |
| Hetzner (zaxira) | ~$8/oy |
| Backblaze B2 (50GB) | ~$3/oy |
| Cloudflare | Bepul |
| Let's Encrypt | Bepul |
| Telegram Bot API | Bepul |
| SMS (Eskiz) ~1000/oy | ~80,000 so'm |
| AI (OpenAI) | ~$30-50/oy |
| Video (WebRTC) | ~$20-40/oy |
| **JAMI** | **~$130-160/oy** |

---

## Kod yozish qoidalari

1. **Har doim TypeScript** — `any` ishlatma
2. **Har endpoint RBAC middleware** bilan himoyala
3. **Barcha amallar audit_log** ga yozilsin
4. **Database transaction** — bir nechta jadval o'zgarganda
5. **Izohlar O'zbek tilida** yoz
6. **Env variables** — hech qachon kod ichiga parol yozma
7. **Validation** — har DTO da class-validator ishlat
8. **Error handling** — har service da try/catch
9. **Pagination** — ro'yxat so'rovlarida limit/offset
10. **Soft delete** — muhim ma'lumotlar o'chirilmaydi, arxivlanadi

---

## Muhim biznes qoidalar

- **15 daqiqa qoidasi:** yangi lid 15 daqiqada javob olishi shart
- **D+15 qoidasi:** o'quvchi kelmasa 15 daqiqada ota-onaga xabar
- **Ilk qabul muhrlanadi:** baseline_assessments o'zgartirib bo'lmaydi
- **Smena farqi → SA alert:** kassa farqi bo'lsa darhol xabar
- **Test zanjiri:** draft → tekshirish → nashr (3 bosqich)
- **Audit log:** 5 yil saqlanadi, o'chirib bo'lmaydi
- **QR dinamik:** 24 soatda avtomatik yangilanadi
- **Ish haqi faqat SA:** boshqa rollar ko'ra olmaydi
