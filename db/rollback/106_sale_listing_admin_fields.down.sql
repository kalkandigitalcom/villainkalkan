-- ===============================================================
-- 106 GERİ ALMA — satılık ilan admin alanlarını kaldırır
-- ===============================================================
-- ⚠️ bathrooms / property_type / is_featured / publication_status /
--    published_at değerleri SİLİNİR. is_published (104) korunur;
--    'unpublished' durumundaki ilanlar zaten is_published=false'tur.
-- Yalnız villa_sale_listings etkilenir.
-- ===============================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_villa_sale_listings_publication_status;

ALTER TABLE public.villa_sale_listings
  DROP CONSTRAINT IF EXISTS villa_sale_listings_publication_sync_check,
  DROP CONSTRAINT IF EXISTS villa_sale_listings_publication_status_check,
  DROP CONSTRAINT IF EXISTS villa_sale_listings_property_type_check,
  DROP CONSTRAINT IF EXISTS villa_sale_listings_bathrooms_check;

ALTER TABLE public.villa_sale_listings
  DROP COLUMN IF EXISTS published_at,
  DROP COLUMN IF EXISTS publication_status,
  DROP COLUMN IF EXISTS is_featured,
  DROP COLUMN IF EXISTS property_type,
  DROP COLUMN IF EXISTS bathrooms;

COMMIT;
