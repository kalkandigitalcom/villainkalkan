-- ============================================================================
-- 🛡️ 104 — SATILIK İLAN BİLGİLERİ (villa_sale_listings + çevirisi)
-- ============================================================================
-- Satılık Villalar modülünün veri altyapısı. Mülk kaydı TEK kalır
-- (public.villa); satışa özgü alanlar 1:1 ayrı tabloda tutulur. Böylece
-- kiralık fiyat (villa_prices), takvim, rezervasyon ve indirim tabloları
-- HİÇ değişmez.
--
-- TABLOLAR (ikisi de BOŞ başlar — backfill YOK):
--   villa_sale_listings              — villa başına en fazla 1 satır
--                                      (PK = villa_id, ON DELETE CASCADE).
--   villa_sale_listing_translations  — yalnız locale='tr'. İngilizce
--                                      canonical içerik ana tabloda
--                                      (EN ana dil, TR ikinci dil; DE YOK).
--
-- GÖRÜNÜRLÜK (ileriki aşamalarda kod tarafında uygulanacak):
--   public satılık = villa.is_active AND villa.deleted_at IS NULL
--                    AND villa.listed_for_sale AND sale.is_published.
--   is_published DEFAULT FALSE → satır eklense bile yayına kendiliğinden
--   çıkmaz.
--
-- MEVCUT SİSTEME ETKİ: Yok. Yeni tablolar; mevcut tablolara ALTER/UPDATE
--   yapılmaz. Mevcut `public.trg_touch_updated_at()` (082) yalnız yeni
--   tablolara trigger olarak bağlanır; fonksiyon DEĞİŞTİRİLMEZ.
--
-- RLS/GRANT: native PostgreSQL'de kullanılmıyor (bkz. 079).
-- ÖN KOŞUL: 082 (trg_touch_updated_at) ve 103 uygulanmış olmalı.
-- ROLLBACK: db/rollback/104_villa_sale_listings.down.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.villa_sale_listings (
  villa_id          uuid PRIMARY KEY REFERENCES public.villa (id) ON DELETE CASCADE,
  reference_code    text,
  sale_price        numeric(14,2),
  sale_currency     text NOT NULL DEFAULT 'EUR',
  price_on_request  boolean NOT NULL DEFAULT false,
  sale_status       text NOT NULL DEFAULT 'available',
  plot_area_m2      numeric(10,2),
  built_area_m2     numeric(10,2),
  room_layout       text,
  year_built        integer,
  floors            integer,
  title_deed_type   text,
  has_garden        boolean NOT NULL DEFAULT false,
  garden_area_m2    numeric(10,2),
  sale_description  text,
  seo_title         text,
  seo_description   text,
  sale_sort_order   integer NOT NULL DEFAULT 0,
  agent_whatsapp    text,
  agent_phone       text,
  is_published      boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT villa_sale_listings_reference_code_key UNIQUE (reference_code),
  CONSTRAINT villa_sale_listings_currency_check
    CHECK (sale_currency IN ('EUR', 'GBP', 'USD', 'TRY')),
  CONSTRAINT villa_sale_listings_status_check
    CHECK (sale_status IN ('available', 'reserved', 'sold')),
  CONSTRAINT villa_sale_listings_price_check
    CHECK (sale_price IS NULL OR sale_price >= 0),
  CONSTRAINT villa_sale_listings_price_present_check
    CHECK (price_on_request OR sale_price IS NOT NULL OR is_published = false),
  CONSTRAINT villa_sale_listings_areas_check
    CHECK (
      (plot_area_m2   IS NULL OR plot_area_m2   >= 0) AND
      (built_area_m2  IS NULL OR built_area_m2  >= 0) AND
      (garden_area_m2 IS NULL OR garden_area_m2 >= 0)
    ),
  CONSTRAINT villa_sale_listings_year_check
    CHECK (year_built IS NULL OR year_built BETWEEN 1800 AND 2200),
  CONSTRAINT villa_sale_listings_floors_check
    CHECK (floors IS NULL OR floors BETWEEN 0 AND 100)
);

COMMENT ON TABLE public.villa_sale_listings IS
  'Satılık ilan bilgileri (villa başına 1:1). Kiralık fiyat/takvim/rezervasyon tablolarından bağımsız. is_published=false varsayılan.';

CREATE INDEX IF NOT EXISTS idx_villa_sale_listings_public
  ON public.villa_sale_listings (sale_sort_order, created_at DESC)
  WHERE is_published = true;

DROP TRIGGER IF EXISTS villa_sale_listings_touch_updated_at ON public.villa_sale_listings;
CREATE TRIGGER villa_sale_listings_touch_updated_at
  BEFORE UPDATE ON public.villa_sale_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.villa_sale_listing_translations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  villa_id          uuid NOT NULL REFERENCES public.villa_sale_listings (villa_id) ON DELETE CASCADE,
  locale            text NOT NULL,
  sale_description  text,
  seo_title         text,
  seo_description   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT villa_sale_listing_translations_locale_check CHECK (locale IN ('tr')),
  CONSTRAINT villa_sale_listing_translations_villa_id_locale_key UNIQUE (villa_id, locale)
);

COMMENT ON TABLE public.villa_sale_listing_translations IS
  'Satılık ilan metinlerinin Türkçe çevirisi. İngilizce canonical içerik villa_sale_listings üzerinde.';

DROP TRIGGER IF EXISTS villa_sale_listing_translations_touch_updated_at ON public.villa_sale_listing_translations;
CREATE TRIGGER villa_sale_listing_translations_touch_updated_at
  BEFORE UPDATE ON public.villa_sale_listing_translations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_touch_updated_at();

COMMIT;
