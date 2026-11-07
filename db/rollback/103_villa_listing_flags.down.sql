-- ===============================================================
-- 103 GERİ ALMA — villa ilan türü bayraklarını kaldırır
-- ===============================================================
-- ⚠️ ÖNCE 104 geri alınmalıdır (villa_sale_listings bu bayraklara
--    mantıksal olarak bağlıdır; FK yoktur ama modül anlamsızlaşır).
-- ⚠️ Eski (listed_for_rent filtresi OLMAYAN) uygulama koduyla birlikte
--    uygulanmalıdır; aksi hâlde kiralık sorgular kolon bulamaz.
-- ⚠️ Satılık-only (listed_for_rent=false) mülkler varsa, geri alma
--    sonrası is_active=true iseler kiralık listelerde görünür hâle gelir.
--    Gerekirse önce: UPDATE public.villa SET is_active = false
--                     WHERE listed_for_rent = false;
-- ===============================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_villa_sale_visibility;

ALTER TABLE public.villa
  DROP CONSTRAINT IF EXISTS villa_listing_type_present;

ALTER TABLE public.villa
  DROP COLUMN IF EXISTS listed_for_sale,
  DROP COLUMN IF EXISTS listed_for_rent;

COMMIT;
