# Claude Code uchun prompt — Ilm Academy CRM UI/UX yaxshilash

Quyidagi matnni Claude Code'ga to'liq nusxalab bering:

---

Sen `frontend/` papkasidagi Next.js ilovaning UI/UX'ini professional darajaga ko'tarasan. Bu o'quv markazi CRM tizimi (admin/manager/ustoz/o'quvchi rollari).

## Kontekst — avval o'qi

- Stack: Next.js 16 (App Router) + Tailwind CSS v4 + TanStack Query + Zustand + lucide-react
- Dizayn etalon: **PreSkool School ERP** (Figma kit) uslubi — toza oq kartalar, indigo brend, och kulrang fon
- `app/globals.css`da brend palitra ALLAQACHON bor: `primary-50 ... primary-900` (asosiy `#3D5EE1`). Yashil `emerald` faqat muvaffaqiyat statuslari uchun, `red` xato/qarz uchun, `amber` ogohlantirish uchun
- `components/ui/PageHeader.tsx` (breadcrumb + title + amallar) va `components/ui/KpiCard.tsx` (oq karta + icon plitka + split footer) allaqachon mavjud — ulardan foydalan
- Emoji ISHLATMA — faqat lucide-react iconlar
- Izohlar o'zbek tilida, TypeScript'da `any` ishlatma

## Ishni boshlashdan oldin

1. `cd frontend && npm install && npm run build` — build xatolarini avval tuzat
2. `npm run dev` bilan har sahifani brauzerda ochib tekshirib bor

## Global qoidalar (har sahifada tekshir)

- Kartalar: `bg-white border border-gray-100 shadow-sm rounded-2xl`
- Har sahifada `PageHeader` (breadcrumb + sarlavha + o'ngda amal tugmalari)
- Asosiy tugma: `bg-primary-600 hover:bg-primary-700 text-white rounded-xl px-4 py-2.5 text-sm font-medium` + lucide icon (16px)
- Ikkilamchi tugma: `bg-white border border-gray-200 hover:bg-gray-50 text-gray-700`
- Statuslar faqat rangli chip: `bg-emerald-100 text-emerald-700` (faol/to'landi), `bg-red-100 text-red-700` (qarz/xato), `bg-amber-100 text-amber-700` (kutilmoqda) — nuqta indikator bilan
- Formalar: label har doim tepada (`text-xs font-medium text-gray-600 mb-1`), input `focus:ring-2 focus:ring-primary-500`, xato matni `text-xs text-red-600 mt-1`
- Bo'sh holatlar (empty state): markazda lucide icon (32px, `text-gray-300`) + tushuntirish + CTA tugma
- Yuklanish: skeleton (`bg-gray-100 animate-pulse rounded-xl`), spinner emas
- Barcha interaktiv elementlarda `transition-colors`, hover holati va `cursor-pointer`
- Responsive: `lg:` breakpoint'da sidebar yig'iladigan bo'lsin (mobilda hamburger)

## Jadval (table) standarti — PreSkool uslubi

Har jadvalli sahifada bitta toolbar qatori:
`Row per page [10▾]` (chapda) · qidiruv input (o'ngda) · sana oralig'i · Filter tugma · Sort tugma
Jadval: sarlavha qatori `bg-gray-50 text-xs font-medium text-gray-500 uppercase`, qatorlar `hover:bg-gray-50/60`, pastda pagination (`Oldingi 1 2 ... N Keyingi`).

## Sahifama-sahifa vazifalar

1. **Sidebar** (`components/Sidebar.tsx`): bo'lim sarlavhalari qo'sh (PreSkool'dagidek guruhlash): ASOSIY (Dashboard, Profil) · O'QUV (O'quvchilar, Guruhlar, Jadval, Davomat, LMS) · MOLIYA (To'lovlar, Moliya) · BOSHQARUV (Lidlar, Xodimlar, Tadbirlar, O'rinbosarlik) · ALOQA (Chat, Sifat, Hisobotlar, Sozlamalar). Sarlavha: `text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pt-4 pb-1`

2. **Header** (`components/Header.tsx`): chapda global qidiruv input (`⌘K` placeholder), o'ngda: bildirishnoma (dropdown ro'yxat bilan), profil menyu (dropdown: Profil / Sozlamalar / Chiqish)

3. **Dashboard** (`app/dashboard/page.tsx`): PreSkool tartibi — tepada 4 KpiCard (split footer bilan), keyin 2 ustun: daromad grafigi (2/3) + davomat donut (1/3), pastda: bugungi darslar ro'yxati + oxirgi to'lovlar jadvali + e'lonlar. Har blok sarlavhasida o'ngda "Barchasi" havolasi

4. **O'quvchilar**: jadval/grid ko'rinish almashtirgich qo'sh (lucide `List`/`LayoutGrid`). Grid rejimda PreSkool student kartasi: tepada ID + status chip + uch nuqta menyu, markazda avatar + ism + guruh, pastda Roll/Gender/Sana qatori, footer'da tez amallar (MessageSquare, Phone, Mail iconlari) + "To'lov" tugma

5. **Davomat**: har o'quvchi qatorida radio-tugmalar guruhi: Keldi / Kech / Kelmadi / Sababli (rangli, tanlanganda to'liq rang) + izoh input + "Hammasini belgilash" dropdown

6. **Jadval (schedule)**: haftalik grid'da har dars rangli kartochka (fan rangi bo'yicha chap chiziq/border-l-4): fan nomi + vaqt + xona + ustoz avatari. Bugungi ustun `bg-primary-50/30`

7. **To'lovlar**: tepada 4 KpiCard, tab'lar (To'lovlar / Qarzdorlar / Muddatli), jadval standarti, har qatorda usul chip (Naqd/Karta/Payme/Click), kvitansiya modal chiroyli chek ko'rinishida

8. **Lidlar (kanban)**: ustun sarlavhalari rangli chiziq bilan (Yangi=ko'k, Suhbatda=amber, Sinov=binafsha, O'quvchi=yashil, Yo'qotildi=qizil), har kartada: ism, telefon, manba icon, vaqt, 15-daqiqa kechikkanlar qizil ramka

9. **Chat**: xabar pufakchalari (o'ziniki o'ngda `bg-primary-600 text-white`, boshqalar chapda oq), sana ajratgichlar, o'qildi belgilari (Check/CheckCheck)

10. **Login**: markazda karta, chapda brend panel (indigo gradient + logo), o'ngda forma — 2 ustunli split layout

## Cheklovlar

- API chaqiruvlar, hook'lar, biznes mantiqqa TEGMA — faqat UI qatlami
- Fayllarni qayta nomlama, faqat kerak bo'lsa yangi komponent yarat (`components/ui/` ichida)
- Har 2-3 sahifadan keyin `npm run build` qilib tekshir
- Ishni sahifama-sahifa qil, har birini brauzerda ko'rib tasdiqla

Yakunda: `npm run build` xatosiz o'tishi shart.

---
