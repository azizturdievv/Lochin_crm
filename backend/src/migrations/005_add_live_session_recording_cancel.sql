-- Migration: Jonli efir sessiyalarida yozib olish tanlovi va bekor qilish sababi
-- Sana: 2026-08-22
-- Dev muhitda synchronize:true avtomatik bajaradi

ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS recording_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR;

COMMENT ON COLUMN live_sessions.recording_enabled IS 'Foydalanuvchi tanlovi — hali haqiqiy Livekit Egress yozib olishni ishga tushirmaydi (kelajakdagi bosqich)';
COMMENT ON COLUMN live_sessions.cancel_reason      IS 'Sessiya bekor qilingan sabab (ixtiyoriy, faqat status=cancelled bo''lganda to''ldiriladi)';
