-- ============================================================================
-- 🛡️ 103 — VILLA İLAN TÜRÜ BAYRAKLARI (kiralık / satılık)
-- ============================================================================
-- Satılık Villalar modülünün 1. aşaması. TEK mülk kaydı (public.villa)
-- korunur; ilan türü iki ortogonal bayrakla ifade edilir:
--
--   listed_for_rent  BOOLEAN NOT NULL DEFAULT TRUE
--     - true  → kiralık listelerde/detayda/sitemap'te görünür (BUGÜNKÜ
--               davranış). Rezervasyon, fiyat, takvim akışı değişmez.
--     - false → yalnız satılık mülk; kiralık public yüzeylerde görünmez.
--
--   listed_for_sale  BOOLEAN NOT NULL DEFAULT FALSE
--     - true  → satılık modülünde (ileriki aşama) listelenebilir.
--
-- GERİYE DÖNÜK UYUMLULUK (mevcut ~1.595 mülk):
--   - ADD COLUMN ... NOT NULL DEFAULT <sabit> → PostgreSQL 11+ mevcut
--     satırları tablo yeniden yazılmadan DEFAULT değeriyle görür. Yani
--     migration anında TÜM mevcut mülkler listed_for_rent=TRUE,
--     listed_for_sale=FALSE olur → hepsi kiralık kalır.
--   - Bu migration HİÇBİR satırı UPDATE/DELETE etmez.
--   - is_active / deleted_at semantiği DEĞİŞMEZ (ortogonal).
--   - Admin INSERT payload'ları bu kolonları göndermediği sürece DEFAULT
--     uygulanır → yeni villalar da kiralık başlar.
--
-- KISIT:
--   villa_listing_type_present — bir mülk en az bir ilan türünde olmalı
--   (ikisi birden FALSE olamaz). Mevcut satırlar DEFAULT ile (TRUE,FALSE)
--   olduğundan kısıt eklenirken ihlal oluşmaz.
--
-- INDEX:
--   idx_villa_sale_visibility — satılık public sorgu yolu için (kısmi;
--   satılık mülk sayısı küçük olacağından küçük indeks).
--   Kiralık sorgu yolu için yeni indeks EKLENMEZ: listed_for_rent=TRUE
--   neredeyse tüm satırlar; mevcut idx_villa_visibility yeterli.
--
-- RLS/GRANT: native PostgreSQL'de RLS/policy kullanılmıyor (bkz. 079) →
--   bu migration policy/grant içermez.
--
-- DEPLOY SIRASI: Bu migration, `listed_for_rent` filtresini kullanan
--   uygulama kodundan ÖNCE uygulanmalıdır (aksi hâlde kolon yok hatası).
--
-- ROLLBACK: db/rollback/103_villa_listing_flags.down.sql
-- ============================================================================

BEGIN;

ALTER TABLE public.villa
  ADD COLUMN IF NOT EXISTS listed_for_rent BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS listed_for_sale BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'villa_listing_type_present'
      AND conrelid = 'public.villa'::regclass
  ) THEN
    ALTER TABLE public.villa
      ADD CONSTRAINT villa_listing_type_present
      CHECK (listed_for_rent OR listed_for_sale);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_villa_sale_visibility
  ON public.villa (listed_for_sale)
  WHERE listed_for_sale = TRUE AND deleted_at IS NULL;

COMMENT ON COLUMN public.villa.listed_for_rent IS
  'true (varsayılan): kiralık public yüzeylerde görünür. false: yalnız satılık mülk — kiralık liste/detay/sitemap dışında kalır.';
COMMENT ON COLUMN public.villa.listed_for_sale IS
  'true: satılık modülünde listelenebilir (bkz. villa_sale_listings). false (varsayılan): satılık değil.';

COMMIT;
