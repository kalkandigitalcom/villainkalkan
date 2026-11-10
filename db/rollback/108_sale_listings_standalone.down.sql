-- ===============================================================
-- 108 GERİ ALMA — bağımsız gayrimenkul desteğini kaldırır
-- ===============================================================
-- ⚠️ Bağımsız (source='standalone') ilan VARSA geri alma DURUR:
--    villa kaydı olmayan ilan 104 şemasında temsil edilemez. Önce bu
--    ilanları admin panelinden silin (fotoğrafları R2'den de silinir).
-- Villa kaynaklı ilanlar ve çevirileri korunur; PK tekrar villa_id olur.
-- Kod geri alınmadan ÖNCE uygulanmamalı (yeni kod 108 şemasını okur).
-- ===============================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.villa_sale_listings WHERE source = 'standalone') THEN
    RAISE EXCEPTION '108 rollback: bağımsız satılık ilan mevcut; önce bu ilanları silin';
  END IF;
END
$$;

DROP TABLE IF EXISTS public.sale_listing_features;
DROP TABLE IF EXISTS public.sale_listing_images;

-- Çeviri: listing_id → villa_id
ALTER TABLE public.villa_sale_listing_translations ADD COLUMN IF NOT EXISTS villa_id uuid;
UPDATE public.villa_sale_listing_translations t
   SET villa_id = l.villa_id
  FROM public.villa_sale_listings l
 WHERE l.id = t.listing_id;

ALTER TABLE public.villa_sale_listing_translations
  DROP CONSTRAINT IF EXISTS villa_sale_listing_translations_listing_id_fkey,
  DROP CONSTRAINT IF EXISTS villa_sale_listing_translations_listing_id_locale_key;

-- PK: id → villa_id
ALTER TABLE public.villa_sale_listings
  DROP CONSTRAINT IF EXISTS villa_sale_listings_source_shape_check,
  DROP CONSTRAINT IF EXISTS villa_sale_listings_source_check,
  DROP CONSTRAINT IF EXISTS villa_sale_listings_slug_format_check,
  DROP CONSTRAINT IF EXISTS villa_sale_listings_bedrooms_check,
  DROP CONSTRAINT IF EXISTS villa_sale_listings_coords_check,
  DROP CONSTRAINT IF EXISTS villa_sale_listings_villa_id_key,
  DROP CONSTRAINT IF EXISTS villa_sale_listings_pkey;
ALTER TABLE public.villa_sale_listings ALTER COLUMN villa_id SET NOT NULL;
ALTER TABLE public.villa_sale_listings ADD CONSTRAINT villa_sale_listings_pkey PRIMARY KEY (villa_id);

ALTER TABLE public.villa_sale_listing_translations ALTER COLUMN villa_id SET NOT NULL;
ALTER TABLE public.villa_sale_listing_translations
  ADD CONSTRAINT villa_sale_listing_translations_villa_id_fkey
    FOREIGN KEY (villa_id) REFERENCES public.villa_sale_listings (villa_id) ON DELETE CASCADE,
  ADD CONSTRAINT villa_sale_listing_translations_villa_id_locale_key UNIQUE (villa_id, locale);
ALTER TABLE public.villa_sale_listing_translations
  DROP COLUMN IF EXISTS listing_id,
  DROP COLUMN IF EXISTS title;

DROP INDEX IF EXISTS public.villa_sale_listings_slug_unique;
DROP INDEX IF EXISTS public.idx_villa_sale_listings_location_id;

ALTER TABLE public.villa_sale_listings
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS bedrooms,
  DROP COLUMN IF EXISTS location_id,
  DROP COLUMN IF EXISTS slug,
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS id;

COMMIT;
