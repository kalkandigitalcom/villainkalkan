-- ============================================================================
-- Migration 099 — blog_posts.show_on_homepage (ana sayfa "Neden Kalkan?")
-- ============================================================================
-- AMAÇ:
--   Admin blog listesinde / düzenleme ekranında "Ana sayfada göster"
--   seçeneği. İşaretli ve YAYINDAKİ (is_active=true) yazı ana sayfadaki
--   görselli içerik bölümünde gösterilir.
--
-- TASARIM:
--   • blog_posts tablosunda öne çıkarma alanı YOKTU (featured / homepage
--     benzeri kolon bulunmuyor) → tek boolean kolon eklenir.
--   • Ana sayfa bölümü TEK yazı gösterir. Kısmi unique index aynı anda
--     en fazla BİR yazının işaretli olmasını veritabanında da garanti
--     eder; API yeni yazıyı işaretlemeden önce diğerlerinin işaretini
--     kaldırır (liste ve düzenleme ekranı aynı kolonu okur → senkron).
--   • Yeni tablo YOK; blog_post_translations / mevcut kolonlar DEĞİŞMEZ.
--
-- BACKWARD-COMPATIBILITY:
--   • DEFAULT false → mevcut yazıların hiçbiri ana sayfada görünmez;
--     mevcut blog listesi / detay / sitemap davranışı değişmez.
--   • IF NOT EXISTS ile tekrar çalıştırılabilir.
--
-- ROLLBACK:
--   BEGIN;
--     DROP INDEX IF EXISTS public.blog_posts_single_homepage_idx;
--     ALTER TABLE public.blog_posts DROP COLUMN IF EXISTS show_on_homepage;
--   COMMIT;
-- ============================================================================

BEGIN;

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS show_on_homepage boolean NOT NULL DEFAULT false;

-- Aynı anda en fazla bir işaretli yazı.
CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_single_homepage_idx
  ON public.blog_posts ((true))
  WHERE show_on_homepage;

COMMENT ON COLUMN public.blog_posts.show_on_homepage IS
  'Ana sayfa "Neden Kalkan?" bölümünde gösterilecek yazı (en fazla bir '
  'satır true; yalnız is_active=true iken public tarafta görünür).';

COMMIT;
