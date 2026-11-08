-- ============================================================================
-- 🛡️ Migration 107 — admin_users.sidebar_permissions backfill ('sale_listings')
-- ============================================================================
-- AMAÇ:
--   Yeni "Satılık İlanlar" admin bölümü kendi yetki anahtarını kullanır
--   ("sale_listings" — app/services/admin-user.service.ts > SIDEBAR_PERMISSIONS,
--   app/(admin)/maki-admin/layout.tsx). Bu migration, ZATEN "villas"
--   (Mülkler) yetkisi olan admin'lere anahtarı idempotent ekler; böylece
--   mülk yöneten admin'ler yeni bölümü hemen görür. "villas" yetkisi
--   OLMAYAN admin'lere VERİLMEZ (yetki genişlemez).
--
--   (013 / 016 / 018 / 064 / 093 backfill'lerinin paraleli.)
--
-- KORUNAN DAVRANIŞ:
--   • Diğer permission'lara dokunulmaz; yalnız eksik anahtar append edilir.
--   • admin_users şeması değişmez; satır silinmez.
--   • Yeni admin oluşturma akışı SIDEBAR_PERMISSIONS'tan default tüm
--     anahtarları verdiği için yeni kayıtlar otomatik sahip olur.
--
-- IDEMPOTENT: `jsonb @>` kontrolü; N kez koşulabilir.
--
-- ROLLBACK: db/rollback/107_admin_sale_listings_permission.down.sql
-- ============================================================================

UPDATE admin_users
SET sidebar_permissions = sidebar_permissions || '["sale_listings"]'::jsonb
WHERE sidebar_permissions @> '["villas"]'::jsonb
  AND NOT (sidebar_permissions @> '["sale_listings"]'::jsonb);
