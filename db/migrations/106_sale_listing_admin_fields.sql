-- ============================================================================
-- 🛡️ 106 — SATILIK İLAN ADMIN ALANLARI (villa_sale_listings genişletme)
-- ============================================================================
-- Admin "Satılık İlanlar" formunun ihtiyaç duyduğu, 104'te OLMAYAN alanlar:
--
--   bathrooms           integer NULL      — banyo sayısı (0..100)
--   property_type       text NOT NULL DEFAULT 'villa'
--                       ('villa','detached_house','apartment','duplex',
--                        'land','commercial','other')
--   is_featured         boolean NOT NULL DEFAULT false — öne çıkarma
--   publication_status  text NOT NULL DEFAULT 'draft'
--                       ('draft','published','unpublished')
--   published_at        timestamptz NULL — ilk yayın zamanı (bilgi)
--
-- YAYIN DURUMU — TEK KURAL:
--   `is_published` (104) public filtrenin basit bayrağı olarak KALIR;
--   `publication_status` admin'in üç durumlu görünümüdür. İkisinin
--   ayrışmaması DB seviyesinde kilitlenir:
--     CHECK (is_published = (publication_status = 'published'))
--   Mevcut satırlar (varsa) önce is_published'tan türetilir.
--
-- MEVCUT SİSTEME ETKİ:
--   YALNIZ villa_sale_listings değişir. villa, villa_prices, rezervasyon,
--   takvim, iCal, kısa süreli fırsat (105) tablolarına/fonksiyonlarına
--   DOKUNULMAZ. Kolon ekleme sabit DEFAULT ile → tablo yeniden yazılmaz.
--
-- ÖN KOŞUL: 104. RLS/GRANT yok (native PG, bkz. 079).
-- ROLLBACK: db/rollback/106_sale_listing_admin_fields.down.sql
-- ============================================================================

BEGIN;

ALTER TABLE public.villa_sale_listings
  ADD COLUMN IF NOT EXISTS bathrooms          integer,
  ADD COLUMN IF NOT EXISTS property_type      text        NOT NULL DEFAULT 'villa',
  ADD COLUMN IF NOT EXISTS is_featured        boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publication_status text        NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at       timestamptz;

-- Mevcut satırlar (yalnız bu tablo): yayın durumu eski bayraktan türetilir.
UPDATE public.villa_sale_listings
   SET publication_status = 'published',
       published_at = COALESCE(published_at, updated_at)
 WHERE is_published = true
   AND publication_status <> 'published';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'villa_sale_listings_bathrooms_check'
                    AND conrelid = 'public.villa_sale_listings'::regclass) THEN
    ALTER TABLE public.villa_sale_listings
      ADD CONSTRAINT villa_sale_listings_bathrooms_check
      CHECK (bathrooms IS NULL OR bathrooms BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'villa_sale_listings_property_type_check'
                    AND conrelid = 'public.villa_sale_listings'::regclass) THEN
    ALTER TABLE public.villa_sale_listings
      ADD CONSTRAINT villa_sale_listings_property_type_check
      CHECK (property_type IN ('villa', 'detached_house', 'apartment', 'duplex', 'land', 'commercial', 'other'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'villa_sale_listings_publication_status_check'
                    AND conrelid = 'public.villa_sale_listings'::regclass) THEN
    ALTER TABLE public.villa_sale_listings
      ADD CONSTRAINT villa_sale_listings_publication_status_check
      CHECK (publication_status IN ('draft', 'published', 'unpublished'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'villa_sale_listings_publication_sync_check'
                    AND conrelid = 'public.villa_sale_listings'::regclass) THEN
    ALTER TABLE public.villa_sale_listings
      ADD CONSTRAINT villa_sale_listings_publication_sync_check
      CHECK (is_published = (publication_status = 'published'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_villa_sale_listings_publication_status
  ON public.villa_sale_listings (publication_status);

COMMENT ON COLUMN public.villa_sale_listings.publication_status IS
  'draft | published | unpublished. is_published ile CHECK üzerinden senkron (published ⇔ is_published=true).';
COMMENT ON COLUMN public.villa_sale_listings.property_type IS
  'villa | detached_house | apartment | duplex | land | commercial | other';

COMMIT;
