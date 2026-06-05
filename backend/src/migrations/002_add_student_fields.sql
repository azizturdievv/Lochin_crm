-- Migration: O'quvchilar jadvaliga yangi ustunlar qo'shish
-- Sana: 2026-06-05
-- Dev muhitda synchronize:true avtomatik bajaradi

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS address        TEXT,
  ADD COLUMN IF NOT EXISTS school_name    VARCHAR(200),
  ADD COLUMN IF NOT EXISTS school_grade   SMALLINT,
  ADD COLUMN IF NOT EXISTS referral_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS referral_person VARCHAR(200),
  ADD COLUMN IF NOT EXISTS notes          TEXT;

-- school_grade 1-11 oralig'ida bo'lishi kerak
ALTER TABLE users
  ADD CONSTRAINT chk_school_grade CHECK (school_grade IS NULL OR (school_grade >= 1 AND school_grade <= 11));

COMMENT ON COLUMN users.address         IS 'Yashash manzili';
COMMENT ON COLUMN users.school_name     IS 'Maktab nomi';
COMMENT ON COLUMN users.school_grade    IS 'Sinf (1-11)';
COMMENT ON COLUMN users.referral_source IS 'Qayerdan keldi: Instagram, Telegram, Do''st, Walk-in, Qo''ng''iroq, Boshqa';
COMMENT ON COLUMN users.referral_person IS 'Kim orqali keldi (ism)';
COMMENT ON COLUMN users.notes           IS 'Qo''shimcha izoh';
