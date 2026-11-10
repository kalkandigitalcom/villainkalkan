-- ============================================================================
-- 🛡️ Migration 108 — Satılık ilanlar: bağımsız gayrimenkul desteği
-- ============================================================================
-- AMAÇ:
--   Satılık ilan iki kaynaktan oluşturulabilir:
--     • source = 'villa'      → mevcut villa kaydına bağlı (villa_id dolu).
--                               Başlık / slug / galeri / olanak / konum
--                               villadan okunur (bugünkü davranış).
--     • source = 'standalone' → kiralık villa kaydı YOK (villa_id NULL).
--                               Başlık, slug, bölge, koordinat, yatak odası
--                               ilanın kendi kolonlarında; fotoğraflar
--                               sale_listing_images, olanaklar
--                               sale_listing_features tablosunda.
--   Bağımsız gayrimenkul `villa` tablosuna ASLA yazılmaz → kiralık liste,
--   arama, rezervasyon, fiyat takvimi, iCal ve kısa süreli fırsat
--   sorguları onu hiçbir koşulda göremez.
--
-- ENGEL (104): villa_sale_listings PK = villa_id (NOT NULL, FK villa) ve
--   çeviri tablosu FK'si villa_id → villasız ilan imkânsızdı.
--
-- DEĞİŞİKLİKLER:
--   1) villa_sale_listings.id (uuid) yeni PRIMARY KEY; mevcut her satıra
--      gen_random_uuid() ile değer verilir (veri kaybı yok).
--      villa_id → NULL olabilir + UNIQUE (villa başına en fazla 1 ilan
--      kuralı korunur); FK villa(id) ON DELETE CASCADE AYNEN kalır.
--   2) Yeni kolonlar: source, title, slug, location_id, bedrooms,
--      latitude, longitude. Mevcut satırlar source='villa' olur.
--      CHECK: villa kaynağında villa_id dolu ve bağımsız alanlar boş;
--      bağımsız kaynakta villa_id boş, title + slug dolu.
--   3) Çeviri tablosu villa_id → listing_id (FK ilan.id ON DELETE
--      CASCADE, UNIQUE (listing_id, locale)); mevcut çeviriler eşlenir.
--      Bağımsız ilan başlığının TR çevirisi için `title` kolonu.
--   4) sale_listing_images  (ilan fotoğrafları; ilan silinince CASCADE).
--   5) sale_listing_features (ilan ↔ villa_features; iki yönde CASCADE).
--
-- KORUNAN DAVRANIŞ:
--   • Mevcut ilanlar, yayın durumları, sıralama ve çeviriler aynen kalır.
--   • villa tablosu, kiralık tablolar, rezervasyon/takvim/iCal DEĞİŞMEZ.
--   • Villa silinince bağlı ilan silinir (104 davranışı).
--   • Bölge silinirse bağımsız ilanın location_id'si NULL olur
--     (ilan kaybolmaz).
--
-- SLUG: Bağımsız ilan slug'ı kendi içinde UNIQUE (partial index). Villa
--   slug'larıyla çakışma uygulama katmanında engellenir (servis); public
--   çözümlemede villa kaynaklı ilan önceliklidir (mevcut URL'ler korunur).
--
-- SIRA: 103 → 104 → 105 → 106 → 107 → 108. Kod deploy'undan ÖNCE.
-- IDEMPOTENT: tekrar koşulabilir (IF NOT EXISTS / koşullu DO blokları).
-- ROLLBACK: db/rollback/108_sale_listings_standalone.down.sql
-- ============================================================================

BEGIN;

-- 1) Surrogate kimlik + bağımsız ilan kolonları --------------------------------
ALTER TABLE public.villa_sale_listings
  ADD COLUMN IF NOT EXISTS id          uuid    NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS source      text    NOT NULL DEFAULT 'villa',
  ADD COLUMN IF NOT EXISTS title       text,
  ADD COLUMN IF NOT EXISTS slug        text,
  ADD COLUMN IF NOT EXISTS location_id uuid    REFERENCES public.villa_locations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bedrooms    integer,
  ADD COLUMN IF NOT EXISTS latitude    numeric(9,6),
  ADD COLUMN IF NOT EXISTS longitude   numeric(9,6);

-- 2) Çeviri tablosu: villa_id → listing_id --------------------------------------
ALTER TABLE public.villa_sale_listing_translations
  ADD COLUMN IF NOT EXISTS listing_id uuid,
  ADD COLUMN IF NOT EXISTS title      text;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = 'villa_sale_listing_translations'
                AND column_name = 'villa_id') THEN
    UPDATE public.villa_sale_listing_translations t
       SET listing_id = l.id
      FROM public.villa_sale_listings l
     WHERE t.listing_id IS NULL
       AND l.villa_id = t.villa_id;

    -- Eşlenemeyen satır olamaz (104 FK'si) — yine de sessiz veri kaybı yok:
    IF EXISTS (SELECT 1 FROM public.villa_sale_listing_translations WHERE listing_id IS NULL) THEN
      RAISE EXCEPTION '108: eşlenemeyen satılık ilan çevirisi var; migration durduruldu';
    END IF;

    ALTER TABLE public.villa_sale_listing_translations
      DROP CONSTRAINT IF EXISTS villa_sale_listing_translations_villa_id_fkey,
      DROP CONSTRAINT IF EXISTS villa_sale_listing_translations_villa_id_locale_key;
    ALTER TABLE public.villa_sale_listing_translations DROP COLUMN villa_id;
  END IF;
END
$$;

ALTER TABLE public.villa_sale_listing_translations
  ALTER COLUMN listing_id SET NOT NULL;

-- 3) PK değişimi: villa_id → id ---------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.conrelid = 'public.villa_sale_listings'::regclass
       AND c.contype = 'p'
       AND a.attname = 'villa_id'
  ) THEN
    ALTER TABLE public.villa_sale_listings DROP CONSTRAINT villa_sale_listings_pkey;
    ALTER TABLE public.villa_sale_listings ADD CONSTRAINT villa_sale_listings_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'villa_sale_listings_villa_id_key'
                    AND conrelid = 'public.villa_sale_listings'::regclass) THEN
    ALTER TABLE public.villa_sale_listings
      ADD CONSTRAINT villa_sale_listings_villa_id_key UNIQUE (villa_id);
  END IF;
END
$$;

ALTER TABLE public.villa_sale_listings ALTER COLUMN villa_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'villa_sale_listing_translations_listing_id_fkey'
                    AND conrelid = 'public.villa_sale_listing_translations'::regclass) THEN
    ALTER TABLE public.villa_sale_listing_translations
      ADD CONSTRAINT villa_sale_listing_translations_listing_id_fkey
      FOREIGN KEY (listing_id) REFERENCES public.villa_sale_listings (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'villa_sale_listing_translations_listing_id_locale_key'
                    AND conrelid = 'public.villa_sale_listing_translations'::regclass) THEN
    ALTER TABLE public.villa_sale_listing_translations
      ADD CONSTRAINT villa_sale_listing_translations_listing_id_locale_key UNIQUE (listing_id, locale);
  END IF;

  -- 4) Kaynak tutarlılığı + alan kuralları ---------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'villa_sale_listings_source_check'
                    AND conrelid = 'public.villa_sale_listings'::regclass) THEN
    ALTER TABLE public.villa_sale_listings
      ADD CONSTRAINT villa_sale_listings_source_check
      CHECK (source IN ('villa', 'standalone'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'villa_sale_listings_source_shape_check'
                    AND conrelid = 'public.villa_sale_listings'::regclass) THEN
    ALTER TABLE public.villa_sale_listings
      ADD CONSTRAINT villa_sale_listings_source_shape_check
      CHECK (
        (source = 'villa'
          AND villa_id IS NOT NULL
          AND title IS NULL AND slug IS NULL AND location_id IS NULL
          AND latitude IS NULL AND longitude IS NULL)
        OR
        (source = 'standalone'
          AND villa_id IS NULL
          AND title IS NOT NULL AND btrim(title) <> ''
          AND slug IS NOT NULL)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'villa_sale_listings_slug_format_check'
                    AND conrelid = 'public.villa_sale_listings'::regclass) THEN
    ALTER TABLE public.villa_sale_listings
      ADD CONSTRAINT villa_sale_listings_slug_format_check
      CHECK (slug IS NULL OR (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 120));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'villa_sale_listings_bedrooms_check'
                    AND conrelid = 'public.villa_sale_listings'::regclass) THEN
    ALTER TABLE public.villa_sale_listings
      ADD CONSTRAINT villa_sale_listings_bedrooms_check
      CHECK (bedrooms IS NULL OR bedrooms BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'villa_sale_listings_coords_check'
                    AND conrelid = 'public.villa_sale_listings'::regclass) THEN
    ALTER TABLE public.villa_sale_listings
      ADD CONSTRAINT villa_sale_listings_coords_check
      CHECK (
        (latitude  IS NULL OR latitude  BETWEEN -90  AND 90) AND
        (longitude IS NULL OR longitude BETWEEN -180 AND 180)
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS villa_sale_listings_slug_unique
  ON public.villa_sale_listings (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_villa_sale_listings_location_id
  ON public.villa_sale_listings (location_id)
  WHERE location_id IS NOT NULL;

COMMENT ON COLUMN public.villa_sale_listings.id IS
  'İlan kimliği (108). Admin / önizleme / çeviri / galeri bu kimliği kullanır.';
COMMENT ON COLUMN public.villa_sale_listings.source IS
  'villa (mevcut villaya bağlı) | standalone (bağımsız gayrimenkul, villa kaydı yok).';
COMMENT ON COLUMN public.villa_sale_listings.slug IS
  'Yalnız bağımsız ilan: /satilik-villa/<slug>. Villa kaynaklı ilan villa.slug kullanır.';

-- 5) Bağımsız ilan fotoğrafları ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sale_listing_images (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid        NOT NULL REFERENCES public.villa_sale_listings (id) ON DELETE CASCADE,
  image_url   text        NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  is_cover    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sale_listing_images_image_url_key UNIQUE (image_url)
);

CREATE INDEX IF NOT EXISTS idx_sale_listing_images_listing_order
  ON public.sale_listing_images (listing_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS sale_listing_images_one_cover
  ON public.sale_listing_images (listing_id)
  WHERE is_cover;

COMMENT ON TABLE public.sale_listing_images IS
  'Bağımsız satılık ilan fotoğrafları (R2 object key). İlan silinince satırlar CASCADE; R2 nesneleri servis tarafından temizlenir.';

-- 6) Bağımsız ilan olanakları --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sale_listing_features (
  listing_id  uuid        NOT NULL REFERENCES public.villa_sale_listings (id) ON DELETE CASCADE,
  feature_id  uuid        NOT NULL REFERENCES public.villa_features (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_sale_listing_features_feature_id
  ON public.sale_listing_features (feature_id);

COMMENT ON TABLE public.sale_listing_features IS
  'Bağımsız satılık ilan ↔ olanak (villa_features taksonomisi paylaşılır). Kiralık villa_feature_relations tablosundan ayrı.';

COMMIT;
