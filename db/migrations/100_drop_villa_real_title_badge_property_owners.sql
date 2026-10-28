-- ============================================================================
-- Migration 100 — villa alanlarının ve Mülk Sahibi modülünün kaldırılması
-- ============================================================================
-- AMAÇ:
--   Admin villa formundan ve tüm sistemden kaldırılan alanları veritabanından
--   da düşürmek:
--     1) villa.real_title_search (GENERATED, mig 078) + trigram index'i
--        villa.real_title (mig 072)                  — "Mülkün Gerçek Adı"
--     2) villa.badge + villa_translations.badge (mig 082) — "Öne Çıkan Etiket"
--     3) villa.owner_id + villa_owner_id_fkey + idx_villa_owner_id,
--        public.property_owners tablosu,
--        admin_users.sidebar_permissions içindeki "property_owners" anahtarı
--                                                     — "Mülk Sahibi" modülü
--
-- KAPSAM DIŞI (BİLİNÇLİ):
--   • villa.tourism_document_number (mig 017) DOKUNULMAZ. Yalnız admin
--     formundan kaldırıldı; public villa detay gösterimi ve Belge Kontrol
--     sistemi (villa_license_check_runs / villa_license_checks /
--     villa_license_states, mig 098) ayrı karar bekliyor.
--   • villa, villa_prices, villa_images, reservations, müsaitlik ve diğer
--     tüm tablolar/kolonlar DEĞİŞMEZ. Satır silinmez (property_owners hariç).
--
-- ⚠️ ÇALIŞTIRMADAN ÖNCE (ZORUNLU):
--   Bu migration GERİ ALINAMAZ veri siler (property_owners satırları — ad,
--   telefon, e-posta, IBAN — ve villa.real_title / villa.badge /
--   villa.owner_id / villa_translations.badge değerleri). Önce yedek alın:
--
--     # 1) Tam şema + veri yedeği (önerilen):
--     pg_dump --format=custom --file=villa_pre_100.dump "$DATABASE_URL"
--
--     # 2) Silinecek verinin ayrıca düz dışa aktarımı (restore kolaylığı):
--     psql "$DATABASE_URL" -c "\copy (SELECT id, real_title, badge, owner_id FROM public.villa) TO 'villa_fields_pre_100.csv' CSV HEADER"
--     psql "$DATABASE_URL" -c "\copy (SELECT id, villa_id, locale, badge FROM public.villa_translations WHERE badge IS NOT NULL) TO 'villa_translations_badge_pre_100.csv' CSV HEADER"
--     psql "$DATABASE_URL" -c "\copy (SELECT * FROM public.property_owners) TO 'property_owners_pre_100.csv' CSV HEADER"
--     psql "$DATABASE_URL" -c "\copy (SELECT id, sidebar_permissions FROM public.admin_users) TO 'admin_users_permissions_pre_100.csv' CSV HEADER"
--
--   Yedek dosyaları KİŞİSEL VERİ (IBAN/telefon) içerir; güvenli saklayın.
--   Uygulama kodu bu kolonları artık okumuyor/yazmıyor; migration'ı, bu
--   kodu içeren sürüm yayına alındıktan SONRA uygulayın (eski sürüm hâlâ
--   çalışırken uygulanırsa eski sürümün sorguları hata verir).
--
-- GÜVENLİK:
--   • Tek transaction (BEGIN/COMMIT) — herhangi bir adım başarısız olursa
--     hiçbir değişiklik kalmaz.
--   • CASCADE KULLANILMAZ — beklenmeyen bir bağımlılık (view, başka FK,
--     fonksiyon) varsa PostgreSQL DROP'u reddeder ve transaction geri döner.
--   • Ön kontrol bloğu bu kolonlara bağlı view veya property_owners'a
--     başka bir FK bulursa açık hata mesajıyla durur.
--   • IF EXISTS ile tekrar çalıştırılabilir (idempotent).
--
-- ROLLBACK / RESTORE (gerekirse, yedekten):
--   Şema:
--     BEGIN;
--       CREATE TABLE public.property_owners (
--         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--         first_name text, last_name text, phone text, email text,
--         iban text, created_at timestamptz NOT NULL DEFAULT now());
--       ALTER TABLE public.villa ADD COLUMN owner_id uuid;
--       ALTER TABLE public.villa ADD CONSTRAINT villa_owner_id_fkey
--         FOREIGN KEY (owner_id) REFERENCES public.property_owners (id)
--         ON DELETE SET NULL;
--       CREATE INDEX idx_villa_owner_id ON public.villa (owner_id);
--       ALTER TABLE public.villa ADD COLUMN badge text;
--       ALTER TABLE public.villa_translations ADD COLUMN badge text;
--       ALTER TABLE public.villa ADD COLUMN real_title text;
--       -- real_title_search: migration 078'deki GENERATED ifadesi + index
--     COMMIT;
--   Veri: property_owners_pre_100.csv → \copy ... FROM; villa ve
--   villa_translations değerleri CSV'lerden geçici tabloya alınıp
--   id/villa_id+locale ile UPDATE edilir; sidebar_permissions
--   admin_users_permissions_pre_100.csv'den geri yazılır.
--   Ardından bu alanları kullanan uygulama sürümüne geri dönülmelidir.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0) ÖN KONTROLLER — beklenmeyen bağımlılık varsa dur.
-- ----------------------------------------------------------------------------
DO $precheck$
DECLARE
  dep text;
BEGIN
  -- Kaldırılacak kolonları kullanan view / materialized view var mı?
  SELECT string_agg(DISTINCT vcu.view_schema || '.' || vcu.view_name, ', ')
    INTO dep
    FROM information_schema.view_column_usage vcu
   WHERE vcu.table_schema = 'public'
     AND (
       (vcu.table_name = 'villa'
         AND vcu.column_name IN ('real_title', 'real_title_search', 'badge', 'owner_id'))
       OR (vcu.table_name = 'villa_translations' AND vcu.column_name = 'badge')
       OR vcu.table_name = 'property_owners'
     );
  IF dep IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 100 durduruldu: kaldırılacak kolonlara bağlı view(lar) var: %', dep;
  END IF;

  -- property_owners'a villa.owner_id DIŞINDA bir FK var mı?
  SELECT string_agg(c.conrelid::regclass::text || '.' || c.conname, ', ')
    INTO dep
    FROM pg_constraint c
   WHERE c.contype = 'f'
     AND c.confrelid = to_regclass('public.property_owners')
     AND c.conname <> 'villa_owner_id_fkey';
  IF dep IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 100 durduruldu: property_owners başka tablolardan referans alıyor: %', dep;
  END IF;
END
$precheck$;

-- ----------------------------------------------------------------------------
-- 1) "Mülkün Gerçek Adı" — önce GENERATED kolon (real_title'a bağımlı) ve
--    index'i, sonra kaynak kolon.
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.villa_real_title_search_trgm_idx;
ALTER TABLE public.villa DROP COLUMN IF EXISTS real_title_search;
ALTER TABLE public.villa DROP COLUMN IF EXISTS real_title;

-- ----------------------------------------------------------------------------
-- 2) "Öne Çıkan Etiket" — villa ve çeviri tablosu.
-- ----------------------------------------------------------------------------
ALTER TABLE public.villa DROP COLUMN IF EXISTS badge;
ALTER TABLE public.villa_translations DROP COLUMN IF EXISTS badge;

COMMENT ON TABLE public.villa_translations IS
  'Villa description/seo_title/seo_description çevirileri (title kolonu '
  'tarihsel; villa adı çevrilmez). public.villa TR base data SOURCE OF '
  'TRUTH kalır. badge kolonu migration 100 ile kaldırıldı.';

-- ----------------------------------------------------------------------------
-- 3) "Mülk Sahibi" modülü — FK → index → kolon → tablo → yetki anahtarı.
-- ----------------------------------------------------------------------------
ALTER TABLE public.villa DROP CONSTRAINT IF EXISTS villa_owner_id_fkey;
DROP INDEX IF EXISTS public.idx_villa_owner_id;
ALTER TABLE public.villa DROP COLUMN IF EXISTS owner_id;
DROP TABLE IF EXISTS public.property_owners;

UPDATE public.admin_users
   SET sidebar_permissions = sidebar_permissions - 'property_owners'
 WHERE sidebar_permissions ? 'property_owners';

COMMIT;

-- ============================================================================
-- DOĞRULAMA (manuel, uygulamadan sonra):
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'villa'
--      AND column_name IN ('real_title','real_title_search','badge','owner_id');
--   -- 0 satır beklenir.
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'villa_translations'
--      AND column_name = 'badge';                        -- 0 satır
--   SELECT to_regclass('public.property_owners');       -- NULL
--   SELECT count(*) FROM public.admin_users
--    WHERE sidebar_permissions ? 'property_owners';     -- 0
--   SELECT count(*) FROM public.villa;                  -- yedekteki sayıyla AYNI
--   SELECT count(*) FROM public.villa
--    WHERE tourism_document_number IS NOT NULL;         -- yedekteki sayıyla AYNI
-- ============================================================================
