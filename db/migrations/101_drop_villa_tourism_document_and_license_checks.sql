-- ============================================================================
-- Migration 101 — Turizm Belge No ve Belge Kontrol sisteminin kaldırılması
-- ============================================================================
-- AMAÇ:
--   T.C. Kültür ve Turizm Bakanlığı belge numarası ve buna bağlı "Belge
--   Kontrol" (KTB doğrulama) özelliği uygulamadan tamamen kaldırıldı.
--   Bu migration veritabanı tarafını temizler:
--     1) public.villa_license_checks      (mig 098) — kontrol geçmişi
--     2) public.villa_license_states      (mig 098) — villa başına son durum
--     3) public.villa_license_check_runs  (mig 098) — tarama kayıtları
--     4) public.villa.tourism_document_number (mig 017)
--   Tablolarla birlikte kendi indeksleri, CHECK constraint'leri ve
--   foreign key'leri (villa / run referansları) düşer. Bu özelliğe ait
--   trigger veya fonksiyon YOKTUR (mig 098 yalnız tablo + index tanımlar).
--
-- UYGULAMA SIRASI:
--   Migration 100 → Migration 101. (100'ün dosya sonundaki doğrulama
--   sorgularından `tourism_document_number` sayımı 101'den ÖNCE çalıştırılmalı.)
--   İkisi de, bu kolonları/tabloları artık kullanmayan uygulama sürümü
--   yayına alındıktan SONRA uygulanmalıdır.
--
-- ⚠️ VERİ KAYBI — GERİ ALINAMAZ:
--   • Bütün villaların turizm belge numaraları (villa.tourism_document_number)
--   • Belge Kontrol tarama geçmişi, kontrol sonuçları ve villa başına son
--     durum kayıtları (üç tablonun TAMAMI)
--   kalıcı olarak silinir. Önce yedek alın:
--
--     # 1) Tam şema + veri yedeği (önerilen):
--     pg_dump --format=custom --file=villa_pre_101.dump "$DATABASE_URL"
--
--     # 2) Silinecek verinin düz dışa aktarımı:
--     psql "$DATABASE_URL" -c "\copy (SELECT id, tourism_document_number FROM public.villa WHERE tourism_document_number IS NOT NULL) TO 'villa_tourism_document_pre_101.csv' CSV HEADER"
--     psql "$DATABASE_URL" -c "\copy (SELECT * FROM public.villa_license_check_runs) TO 'villa_license_check_runs_pre_101.csv' CSV HEADER"
--     psql "$DATABASE_URL" -c "\copy (SELECT * FROM public.villa_license_checks) TO 'villa_license_checks_pre_101.csv' CSV HEADER"
--     psql "$DATABASE_URL" -c "\copy (SELECT * FROM public.villa_license_states) TO 'villa_license_states_pre_101.csv' CSV HEADER"
--
-- GÜVENLİK:
--   • Tek transaction (BEGIN/COMMIT).
--   • CASCADE KULLANILMAZ. Ön kontrol; bu kolona/tablolara bağlı view,
--     bu üç tablo DIŞINDAN gelen foreign key veya public şemada bunlara
--     atıf yapan fonksiyon bulursa açık hata ile durur (hiçbir şey silinmez).
--   • Silme sırası bağımlılığa göre: checks (runs + villa'ya FK) → states
--     (villa'ya FK) → runs → villa kolonu.
--   • IF EXISTS ile tekrar çalıştırılabilir (idempotent).
--   • villa, villa_prices, villa_images, reservations, müsaitlik ve diğer
--     tablolardaki satırlar DEĞİŞMEZ.
--
-- ROLLBACK / RESTORE (gerekirse, yedekten):
--   Şema: migration 017 (kolon) ve migration 098 (üç tablo + index'ler)
--   aynen yeniden çalıştırılır (ikisi de IF NOT EXISTS ile yazılmıştır).
--   Veri: CSV'ler `\copy ... FROM` ile; villa belge numaraları geçici
--   tabloya alınıp id ile UPDATE edilir. Sıra: runs → checks → states.
--   Ardından bu özellikleri kullanan uygulama sürümüne geri dönülmelidir.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0) ÖN KONTROLLER — beklenmeyen bağımlılık varsa dur.
-- ----------------------------------------------------------------------------
DO $precheck$
DECLARE
  dep text;
BEGIN
  -- View / materialized view bağımlılıkları (kolon veya tablo düzeyi).
  SELECT string_agg(DISTINCT v, ', ') INTO dep
    FROM (
      SELECT vcu.view_schema || '.' || vcu.view_name AS v
        FROM information_schema.view_column_usage vcu
       WHERE vcu.table_schema = 'public'
         AND vcu.table_name = 'villa'
         AND vcu.column_name = 'tourism_document_number'
      UNION
      SELECT vtu.view_schema || '.' || vtu.view_name
        FROM information_schema.view_table_usage vtu
       WHERE vtu.table_schema = 'public'
         AND vtu.table_name IN ('villa_license_check_runs',
                                'villa_license_checks',
                                'villa_license_states')
    ) s;
  IF dep IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 101 durduruldu: kaldırılacak kolon/tablolara bağlı view(lar) var: %', dep;
  END IF;

  -- Bu üç tablo DIŞINDAN gelen foreign key var mı?
  SELECT string_agg(c.conrelid::regclass::text || '.' || c.conname, ', ') INTO dep
    FROM pg_constraint c
   WHERE c.contype = 'f'
     AND c.confrelid IN (
           SELECT x FROM (VALUES
             (to_regclass('public.villa_license_check_runs')),
             (to_regclass('public.villa_license_checks')),
             (to_regclass('public.villa_license_states'))
           ) t(x) WHERE x IS NOT NULL)
     AND c.conrelid NOT IN (
           SELECT x FROM (VALUES
             (to_regclass('public.villa_license_check_runs')),
             (to_regclass('public.villa_license_checks')),
             (to_regclass('public.villa_license_states'))
           ) t(x) WHERE x IS NOT NULL);
  IF dep IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 101 durduruldu: Belge Kontrol tablolarına başka tablolardan referans var: %', dep;
  END IF;

  -- public şemada bu kolona/tablolara atıf yapan fonksiyon var mı?
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO dep
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prokind IN ('f', 'p')
     AND (p.prosrc ILIKE '%tourism_document_number%'
          OR p.prosrc ILIKE '%villa_license_%');
  IF dep IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 101 durduruldu: kaldırılacak kolon/tablolara atıf yapan fonksiyon(lar) var: %', dep;
  END IF;
END
$precheck$;

-- ----------------------------------------------------------------------------
-- 1) Belge Kontrol tabloları (index / constraint / FK'leriyle birlikte).
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.villa_license_checks;
DROP TABLE IF EXISTS public.villa_license_states;
DROP TABLE IF EXISTS public.villa_license_check_runs;

-- ----------------------------------------------------------------------------
-- 2) Turizm belge numarası kolonu (mig 017 — index/constraint YOK).
-- ----------------------------------------------------------------------------
ALTER TABLE public.villa DROP COLUMN IF EXISTS tourism_document_number;

COMMIT;

-- ============================================================================
-- DOĞRULAMA (manuel, uygulamadan sonra):
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'villa'
--      AND column_name = 'tourism_document_number';          -- 0 satır
--   SELECT to_regclass('public.villa_license_check_runs'),
--          to_regclass('public.villa_license_checks'),
--          to_regclass('public.villa_license_states');         -- NULL, NULL, NULL
--   SELECT count(*) FROM public.villa;                         -- yedekle AYNI
--   SELECT count(*) FROM public.villa_prices;                  -- yedekle AYNI
--   SELECT count(*) FROM public.reservations;                  -- yedekle AYNI
-- ============================================================================
