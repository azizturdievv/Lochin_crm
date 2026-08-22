-- Migration: Test uchun "jon" (hayot) mexanizmi — nechta xato javobdan keyin
-- urinish avtomatik yakunlanadi (Duolingo uslubi)
-- Sana: 2026-08-22
-- Dev muhitda synchronize:true avtomatik bajaradi

ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS lives_limit SMALLINT;

ALTER TABLE tests
  ADD CONSTRAINT chk_tests_lives_limit CHECK (lives_limit IS NULL OR lives_limit >= 1);

ALTER TABLE test_results
  ADD COLUMN IF NOT EXISTS wrong_count SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eliminated  BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN tests.lives_limit        IS 'Nechta xato javobdan keyin urinish avtomatik tugaydi. NULL = cheksiz (jonsiz rejim, standart)';
COMMENT ON COLUMN test_results.wrong_count IS 'Shu urinishda hozirgacha berilgan xato javoblar soni';
COMMENT ON COLUMN test_results.eliminated  IS 'true = urinish jonlar tugagani sababli avtomatik yakunlangan';
