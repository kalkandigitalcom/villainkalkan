-- ===============================================================
-- 104 GERİ ALMA — satılık ilan tablolarını kaldırır
-- ===============================================================
-- ⚠️ Girilmiş satış bilgileri SİLİNİR. Gerekirse önce yedek alın:
--    CREATE TABLE villa_sale_listings_backup AS TABLE public.villa_sale_listings;
-- Mevcut tablolara (villa, villa_prices, reservations …) dokunmaz.
-- public.trg_touch_updated_at() fonksiyonu 082'ye aittir, SİLİNMEZ.
-- ===============================================================

BEGIN;

DROP TABLE IF EXISTS public.villa_sale_listing_translations;
DROP TABLE IF EXISTS public.villa_sale_listings;

COMMIT;
