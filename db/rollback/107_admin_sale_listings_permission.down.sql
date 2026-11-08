-- ===============================================================
-- 107 GERİ ALMA — 'sale_listings' anahtarını tüm admin'lerden kaldırır
-- ===============================================================
UPDATE admin_users
SET sidebar_permissions = sidebar_permissions - 'sale_listings'
WHERE sidebar_permissions @> '["sale_listings"]'::jsonb;
