// Barcha 8 ta trigger uchun shablon tizimi
// Qo'llab-quvvatlanadigan o'zgaruvchilar: {{ism}}, {{familiya}}, {{summa}},
// {{fan}}, {{sana}}, {{guruh}}, {{ball}}, {{daraja}}, {{ota_ism}},
// {{dars_vaqt}}, {{kech_daqiqa}}, {{sarlavha}}, {{oy}}

export type TemplateVars = Partial<{
  ism: string;
  familiya: string;
  summa: string;
  fan: string;
  sana: string;
  guruh: string;
  ball: string;
  daraja: string;
  ota_ism: string;
  dars_vaqt: string;
  kech_daqiqa: string;
  sarlavha: string;
  oy: string;
}>;

export type ChannelTemplate = {
  sms: string;
  telegram: string;
  pushTitle: string;
  pushBody: string;
};

// O'zgaruvchilarni shablon ichiga joylashtiradi
export function render(template: string, vars: TemplateVars): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.split(`{{${key}}}`).join(value ?? ''),
    template,
  );
}

// 8 ta trigger uchun shablonlar
export const TEMPLATES: Record<string, ChannelTemplate> = {
  // 1. Davomat — kelmadi (ota-onaga D+15)
  'attendance.absent': {
    sms: '{{ism}} {{sana}} kuni {{fan}} darsiga kelmadi. Iltimos, markaz bilan bog\'laning. Lochin School',
    telegram:
      '📚 *Davomat xabardorligi*\n\n*{{ism}}* {{sana}} kuni *{{fan}}* darsiga kelmadi.\n\n_Iltimos, o\'quvchi bilan bog\'laning._',
    pushTitle: 'Darsga kelmadi',
    pushBody: '{{ism}} — {{fan}} darsi ({{sana}})',
  },

  // 2. Davomat — kech qoldi
  'attendance.late': {
    sms: '{{ism}} {{fan}} darsiga {{kech_daqiqa}} daqiqa kech qoldi. {{sana}}. Lochin School',
    telegram:
      '⏰ *Kech qolish*\n\n*{{ism}}* {{fan}} darsiga *{{kech_daqiqa}} daqiqa* kech qoldi.\nSana: {{sana}}',
    pushTitle: 'Kech qolish',
    pushBody: '{{ism}} — {{kech_daqiqa}} daqiqa kech ({{fan}})',
  },

  // 3. To'lov eslatmasi — qarzdorlik
  'payment.reminder': {
    sms: '{{ism}}, {{oy}} oyi o\'quv to\'lovi amalga oshirilmagan. Markaz bilan bog\'laning. Lochin School',
    telegram:
      '💳 *To\'lov eslatmasi*\n\nHurmatli *{{ism}}*!\n{{oy}} oyi uchun to\'lov amalga oshirilmagan.\n\nMarkaz kassasiga tashrif buyuring yoki menejer bilan bog\'laning.',
    pushTitle: "To'lov eslatmasi",
    pushBody: '{{oy}} oyi to\'lovi kutilmoqda',
  },

  // 4. To'lov — qabul qilindi
  'payment.received': {
    sms: '{{ism}}, {{summa}} so\'m qabul qilindi. {{oy}} to\'lovi tasdiqlandi. Lochin School',
    telegram:
      '✅ *To\'lov qabul qilindi*\n\nHurmatli *{{ism}}*!\n*{{summa}} so\'m* muvaffaqiyatli qabul qilindi.\n{{oy}} oyi to\'lovi tasdiqlandi. 🎉',
    pushTitle: "To'lov tasdiqlandi",
    pushBody: '{{summa}} so\'m qabul qilindi — {{oy}}',
  },

  // 5. Test natijasi
  'test.result': {
    sms: '{{ism}}, {{fan}} testida {{ball}}% to\'pladingiz. Daraja: {{daraja}}. Lochin School',
    telegram:
      '📝 *Test natijasi*\n\nHurmatli *{{ism}}*!\n{{fan}} testini yakunladingiz.\n\n🏆 Natija: *{{ball}}%*\n📊 Daraja: *{{daraja}}*',
    pushTitle: 'Test natijasi',
    pushBody: '{{fan}}: {{ball}}% — {{daraja}}',
  },

  // 6. Vazifa — berildi
  'homework.assigned': {
    sms: '{{fan}} fanidan yangi vazifa: {{sarlavha}}. Muddat: {{sana}}. Lochin School',
    telegram:
      '📋 *Yangi vazifa*\n\n*{{fan}}* fanidan yangi vazifa:\n*{{sarlavha}}*\n\n📅 Topshirish muddati: {{sana}}',
    pushTitle: 'Yangi vazifa',
    pushBody: '{{fan}}: {{sarlavha}} ({{sana}})',
  },

  // 7. Vazifa — baholandi
  'homework.graded': {
    sms: '{{ism}}, {{fan}} vazifangiz baholandi: {{ball}} ball. Lochin School',
    telegram:
      '✍️ *Vazifa baholandi*\n\nHurmatli *{{ism}}*!\n*{{fan}}* fanidagi vazifangiz baholandi.\n\nBaho: *{{ball}} ball*',
    pushTitle: 'Vazifa baholandi',
    pushBody: '{{fan}} — {{ball}} ball',
  },

  // 8. Jadval o'zgardi
  'schedule.changed': {
    sms: '{{fan}} darsi vaqti o\'zgardi: {{dars_vaqt}}. {{sana}}. Lochin School',
    telegram:
      '📅 *Jadval o\'zgardi*\n\n*{{fan}}* darsining vaqti o\'zgardi.\n⏰ Yangi vaqt: *{{dars_vaqt}}*\n📆 Sana: {{sana}}',
    pushTitle: "Jadval o'zgardi",
    pushBody: '{{fan}} — {{dars_vaqt}} ({{sana}})',
  },

  // 9. Dars bekor
  'schedule.cancelled': {
    sms: '{{fan}} darsining {{sana}} kuni darsi bekor qilindi. Lochin School',
    telegram: '❌ *Dars bekor qilindi*\n\n*{{fan}}* darsining {{sana}} kuni darsi bekor qilindi.',
    pushTitle: 'Dars bekor',
    pushBody: '{{fan}} darsi {{sana}} bekor qilindi',
  },

  // 10. E'lon
  'announcement.new': {
    sms: 'Lochin School: {{sarlavha}}. Batafsil CRM ilovada ko\'ring.',
    telegram: "📢 *Yangi e'lon*\n\n*{{sarlavha}}*\n\n{{ism}}\n\n_{{sana}}_",
    pushTitle: "Yangi e'lon",
    pushBody: '{{sarlavha}}',
  },

  // 11. Tug'ilgan kun (xodim)
  'birthday.staff': {
    sms: '',
    telegram:
      "🎂 *Tug'ilgan kun muborak!*\n\nHurmatli *{{ism}}*, tug'ilgan kuningiz bilan tabriklaymiz! 🎉\n\n_Lochin School jamoasidan_",
    pushTitle: "Tug'ilgan kun muborak! 🎂",
    pushBody: 'Lochin School jamoasi sizni tabriklamoqda!',
  },

  // 12. Tug'ilgan kun (o'quvchi)
  'birthday.student': {
    sms: '',
    telegram:
      "🎂 *Tug'ilgan kun muborak!*\n\n*{{ism}}*, tug'ilgan kuningiz bilan tabriklaymiz! 🎉\n\n_Lochin School jamoasidan_",
    pushTitle: "Tug'ilgan kun muborak! 🎂",
    pushBody: 'Lochin School tabriklamoqda! 🎉',
  },

  // 13. Favqulodda xabar
  'emergency.urgent': {
    sms: 'MUHIM: {{sarlavha}}. {{ism}}. Lochin School',
    telegram: '🚨 *FAVQULODDA XABAR*\n\n*{{sarlavha}}*\n\n{{ism}}',
    pushTitle: '🚨 Favqulodda',
    pushBody: '{{sarlavha}}',
  },
} as const;

// Oy nomlarini o'zbek tilida
export const OY_NOMLARI: Record<string, string> = {
  '01': 'Yanvar', '02': 'Fevral', '03': 'Mart', '04': 'Aprel',
  '05': 'May', '06': 'Iyun', '07': 'Iyul', '08': 'Avgust',
  '09': 'Sentabr', '10': 'Oktabr', '11': 'Noyabr', '12': 'Dekabr',
};

// YYYY-MM → "Yanvar 2024"
export function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-');
  return `${OY_NOMLARI[month] ?? month} ${year}`;
}

// Date → "15 Yanvar 2024"
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getDate()} ${OY_NOMLARI[month] ?? month} ${d.getFullYear()}`;
}
