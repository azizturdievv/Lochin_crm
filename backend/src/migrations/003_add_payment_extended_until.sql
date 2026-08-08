-- Migration: To'lov avto-blok uchun vaqtincha uzaytirish ustuni
-- Sana: 2026-07-29
-- Dev muhitda synchronize:true avtomatik bajaradi

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payment_extended_until TIMESTAMPTZ;

COMMENT ON COLUMN users.payment_extended_until IS 'SA tomonidan vaqtincha uzaytirilgan to''lov muddati (locked_until — brute-force uchun, bu ustun — to''lov qulfi uchun)';
