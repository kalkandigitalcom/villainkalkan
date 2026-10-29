-- ===============================================================
-- 102 — İÇERİK KAYNAK DİLİ: TÜRKÇE → İNGİLİZCE (geri alınabilir)
-- ===============================================================
-- AMAÇ
--   Uygulama artık İngilizceyi ANA (kaynak) içerik dili, Türkçeyi
--   ÇEVİRİ olarak ele alır (lib/i18n/config.ts → DEFAULT_LOCALE = "en",
--   TRANSLATION_LOCALE = "tr"):
--     • canonical kolonlar (villa.description, pages.title, …) = İngilizce
--     • <entity>_translations.locale = 'tr' satırları       = Türkçe
--   Bu migration mevcut veriyi (canonical = Türkçe, çeviri = 'en')
--   yeni modele taşır. HİÇBİR içerik silinmez veya kaybolmaz:
--
--   1) Her parent tablonun çevrilebilir canonical kolonları ve her
--      çeviri tablosunun TAMAMI `i18n_backup_102` şemasına kopyalanır.
--   2) Mevcut canonical (Türkçe) değerler AYNEN yeni `locale = 'tr'`
--      çeviri satırlarına yazılır.
--   3) Canonical kolonlar, ALAN BAZINDA, mevcut İngilizce çeviri
--      DOLUYSA onunla güncellenir. İngilizce çevirisi boş/eksik alan
--      canonical'da Türkçe metni KORUR (bugünkü İngilizce sayfa
--      fallback'iyle aynı görünüm — otomatik çeviri YAPILMAZ).
--   4) Eski `locale = 'en'` satırları SİLİNMEZ (artık okunmaz; değerleri
--      canonical'a taşınmıştır). İstenirse yedek alındıktan sonra ayrı
--      bir işlemle temizlenebilir.
--
--   GÖRÜNÜR ETKİ: İngilizce sayfa (prefix'siz) bugünkü EN görünümüyle,
--   Türkçe sayfa (/tr) bugünkü TR görünümüyle AYNI kalır.
--
-- ⚠️ DEPLOY SIRASI: Bu migration, İngilizce-ana-dil kodu (DEFAULT_LOCALE
--   = "en") ile AYNI bakım penceresinde uygulanmalıdır. Kod tek başına
--   yayına çıkarsa İngilizce sayfalar canonical (Türkçe) metni gösterir;
--   migration tek başına uygulanırsa eski kod Türkçe sayfada İngilizce
--   metni gösterir.
--
-- ÖN KOŞULLAR (sağlanmazsa migration HİÇBİR ŞEY yapmadan durur):
--   • Hiçbir çeviri tablosunda `locale = 'tr'` satırı yoktur.
--   • Migration daha önce uygulanmamıştır (i18n_backup_102.applied yok).
--
-- KAPSAM (parent → çeviri tablosu : alanlar)
--   villa                → villa_translations              : description, seo_title, seo_description
--   villa_types          → villa_type_translations         : name
--   villa_features       → villa_feature_translations      : name
--   rule_items           → rule_item_translations          : title
--   price_include_items  → price_include_item_translations : title
--   pages                → page_translations               : title, body (veya content), excerpt, seo_title, seo_description, sections
--   faqs                 → faq_translations                : question, answer
--   menu                 → menu_translations               : name
--   payment_methods      → payment_method_translations     : name
--   blog_posts           → blog_post_translations          : title, body, excerpt, seo_title, seo_description
--   settings             → settings_translations           : footer_copyright, default_meta_title, default_meta_description,
--                                                            hero_title, hero_subtitle, hero_badge_text,
--                                                            hero_primary_cta_text, hero_secondary_cta_text, business_hours
--   site_popup           → site_popup_translations         : title, description, highlight_text, stats, button_text, button_url
--   KAPSAM DIŞI: villa.title ve bölge adları (özel isim — çevrilmez),
--   villa_distances (çeviri tablosu yok; görünen ad statik sözlükten).
--   Yalnız İKİ tabloda da GERÇEKTEN bulunan kolonlar işlenir.
--
-- GERİ ALMA: db/rollback/102_content_source_locale_en.down.sql
--   (yedekten canonical değerleri geri yükler, 'tr' satırlarını yedekleyip
--   kaldırır, CHECK kısıtlarını eski hâline döndürür).
--
-- ÇALIŞTIRMA: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 102_content_source_locale_en.sql
-- ===============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS i18n_backup_102;

DO $migration$
BEGIN
  IF to_regclass('i18n_backup_102.applied') IS NOT NULL THEN
    RAISE NOTICE '102: zaten uygulanmış (i18n_backup_102.applied var) — atlanıyor.';
  END IF;
END
$migration$;

-- ---------------------------------------------------------------
-- 0) settings / site_popup çeviri tablolarına 'tr' izni
--    (diğer çeviri tablolarının CHECK'i zaten 'tr','en','de').
-- ---------------------------------------------------------------
DO $checks$
BEGIN
  IF to_regclass('i18n_backup_102.applied') IS NOT NULL THEN RETURN; END IF;

  IF to_regclass('public.settings_translations') IS NOT NULL THEN
    ALTER TABLE public.settings_translations
      DROP CONSTRAINT IF EXISTS settings_translations_locale_check;
    ALTER TABLE public.settings_translations
      ADD CONSTRAINT settings_translations_locale_check
      CHECK (locale IN ('tr', 'en', 'de'));
  END IF;

  IF to_regclass('public.site_popup_translations') IS NOT NULL THEN
    ALTER TABLE public.site_popup_translations
      DROP CONSTRAINT IF EXISTS site_popup_translations_locale_check;
    ALTER TABLE public.site_popup_translations
      ADD CONSTRAINT site_popup_translations_locale_check
      CHECK (locale IN ('tr', 'en', 'de'));
  END IF;
END
$checks$;

-- ---------------------------------------------------------------
-- Yardımcı: tek entity için yedek + 'tr' satırları + canonical güncelleme.
--   p_pairs: 'parent_kolon:ceviri_kolon' çiftleri.
-- ---------------------------------------------------------------
CREATE FUNCTION pg_temp.i18n_102_swap(
  p_parent text,
  p_pk     text,
  p_trans  text,
  p_fk     text,
  p_pairs  text[]
) RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_pair        text;
  v_pcol        text;
  v_tcol        text;
  v_pcols       text[] := ARRAY[]::text[];
  v_tcols       text[] := ARRAY[]::text[];
  v_is_json     boolean[] := ARRAY[]::boolean[];
  v_type        text;
  v_ttype       text;
  v_i           int;
  v_tr_count    bigint;
  v_select      text;
  v_nonempty    text;
  v_set         text;
  v_rows        bigint;
BEGIN
  IF to_regclass('public.' || p_parent) IS NULL
     OR to_regclass('public.' || p_trans) IS NULL THEN
    RAISE NOTICE '102: % / % yok — atlandı', p_parent, p_trans;
    RETURN;
  END IF;

  /* Yalnız iki tabloda da bulunan kolonlar. */
  FOREACH v_pair IN ARRAY p_pairs LOOP
    v_pcol := split_part(v_pair, ':', 1);
    v_tcol := split_part(v_pair, ':', 2);
    SELECT data_type INTO v_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = p_parent AND column_name = v_pcol;
    SELECT data_type INTO v_ttype FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = p_trans AND column_name = v_tcol;
    IF v_type IS NOT NULL AND v_ttype IS NOT NULL THEN
      v_pcols   := v_pcols || v_pcol;
      v_tcols   := v_tcols || v_tcol;
      v_is_json := v_is_json || (v_type IN ('json', 'jsonb'));
    END IF;
  END LOOP;

  IF coalesce(array_length(v_pcols, 1), 0) = 0 THEN
    RAISE NOTICE '102: % için ortak kolon yok — atlandı', p_parent;
    RETURN;
  END IF;

  /* Ön koşul: 'tr' çeviri satırı OLMAMALI (üzerine yazma riski). */
  EXECUTE format('SELECT count(*) FROM public.%I WHERE locale = %L', p_trans, 'tr')
    INTO v_tr_count;
  IF v_tr_count > 0 THEN
    RAISE EXCEPTION '102: public.% tablosunda % adet locale=''tr'' satırı var — migration durduruldu, hiçbir değişiklik yapılmadı.', p_trans, v_tr_count;
  END IF;

  IF to_regclass('i18n_backup_102.' || p_parent || '__canonical') IS NOT NULL THEN
    RAISE EXCEPTION '102: i18n_backup_102.%__canonical zaten var (önceki uygulama/geri alma yedeği). Yedek şemayı arşivleyip yeniden deneyin.', p_parent;
  END IF;

  /* 1) Yedekler. */
  v_select := '';
  FOR v_i IN 1 .. array_length(v_pcols, 1) LOOP
    v_select := v_select || format(', %I', v_pcols[v_i]);
  END LOOP;
  EXECUTE format(
    'CREATE TABLE i18n_backup_102.%I AS SELECT %I%s FROM public.%I',
    p_parent || '__canonical', p_pk, v_select, p_parent
  );
  EXECUTE format(
    'CREATE TABLE i18n_backup_102.%I AS SELECT * FROM public.%I',
    p_trans || '__before', p_trans
  );

  /* 2) Mevcut canonical (Türkçe) → yeni 'tr' çeviri satırları.
        Çevrilebilir alanların hepsi boş olan parent için satır açılmaz. */
  v_select := '';
  v_nonempty := '';
  FOR v_i IN 1 .. array_length(v_pcols, 1) LOOP
    IF v_is_json[v_i] THEN
      v_select := v_select || format(', p.%I', v_pcols[v_i]);
      v_nonempty := v_nonempty || format(
        ' OR (p.%1$I IS NOT NULL AND p.%1$I::text NOT IN (''[]'', ''{}'', ''null''))',
        v_pcols[v_i]);
    ELSE
      v_select := v_select || format(', p.%I', v_pcols[v_i]);
      v_nonempty := v_nonempty || format(
        ' OR NULLIF(btrim(p.%I::text), '''') IS NOT NULL', v_pcols[v_i]);
    END IF;
  END LOOP;

  EXECUTE format(
    'INSERT INTO public.%I (%I, locale%s) SELECT p.%I, %L%s FROM public.%I p WHERE false%s',
    p_trans,
    p_fk,
    (SELECT string_agg(format(', %I', c), '') FROM unnest(v_tcols) AS c),
    p_pk, 'tr', v_select,
    p_parent,
    v_nonempty
  );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RAISE NOTICE '102: % → % : % Türkçe çeviri satırı oluşturuldu', p_parent, p_trans, v_rows;

  /* 3) Canonical ← dolu İngilizce çeviri alanı (alan bazında). */
  v_set := '';
  FOR v_i IN 1 .. array_length(v_pcols, 1) LOOP
    IF v_set <> '' THEN v_set := v_set || ', '; END IF;
    IF v_is_json[v_i] THEN
      v_set := v_set || format(
        '%1$I = CASE WHEN jsonb_typeof(t.%2$I::jsonb) = ''array'' AND jsonb_array_length(t.%2$I::jsonb) > 0 THEN t.%2$I ELSE p.%1$I END',
        v_pcols[v_i], v_tcols[v_i]);
    ELSE
      v_set := v_set || format(
        '%1$I = CASE WHEN NULLIF(btrim(t.%2$I::text), '''') IS NOT NULL THEN t.%2$I ELSE p.%1$I END',
        v_pcols[v_i], v_tcols[v_i]);
    END IF;
  END LOOP;

  EXECUTE format(
    'UPDATE public.%I p SET %s FROM public.%I t WHERE t.%I = p.%I AND t.locale = %L',
    p_parent, v_set, p_trans, p_fk, p_pk, 'en'
  );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RAISE NOTICE '102: % : % kayıt İngilizce ana içerikle güncellendi', p_parent, v_rows;
END
$fn$;

DO $swap$
DECLARE
  v_page_body text;
BEGIN
  IF to_regclass('i18n_backup_102.applied') IS NOT NULL THEN RETURN; END IF;

  /* pages: gövde kolonu `body` (yoksa eski `content`). */
  SELECT CASE
           WHEN EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'pages' AND column_name = 'body')
           THEN 'body'
           ELSE 'content'
         END
    INTO v_page_body;

  PERFORM pg_temp.i18n_102_swap('villa', 'id', 'villa_translations', 'villa_id',
    ARRAY['description:description', 'seo_title:seo_title', 'seo_description:seo_description']);
  PERFORM pg_temp.i18n_102_swap('villa_types', 'id', 'villa_type_translations', 'type_id',
    ARRAY['name:name']);
  PERFORM pg_temp.i18n_102_swap('villa_features', 'id', 'villa_feature_translations', 'feature_id',
    ARRAY['name:name']);
  PERFORM pg_temp.i18n_102_swap('rule_items', 'id', 'rule_item_translations', 'rule_id',
    ARRAY['title:title']);
  PERFORM pg_temp.i18n_102_swap('price_include_items', 'id', 'price_include_item_translations', 'include_id',
    ARRAY['title:title']);
  PERFORM pg_temp.i18n_102_swap('pages', 'id', 'page_translations', 'page_id',
    ARRAY['title:title', v_page_body || ':body', 'excerpt:excerpt',
          'seo_title:seo_title', 'seo_description:seo_description', 'sections:sections']);
  PERFORM pg_temp.i18n_102_swap('faqs', 'id', 'faq_translations', 'faq_id',
    ARRAY['question:question', 'answer:answer']);
  PERFORM pg_temp.i18n_102_swap('menu', 'id', 'menu_translations', 'menu_id',
    ARRAY['name:name']);
  PERFORM pg_temp.i18n_102_swap('payment_methods', 'id', 'payment_method_translations', 'payment_method_id',
    ARRAY['name:name']);
  PERFORM pg_temp.i18n_102_swap('blog_posts', 'id', 'blog_post_translations', 'blog_post_id',
    ARRAY['title:title', 'body:body', 'excerpt:excerpt', 'seo_title:seo_title', 'seo_description:seo_description']);
  PERFORM pg_temp.i18n_102_swap('settings', 'id', 'settings_translations', 'settings_id',
    ARRAY['footer_copyright:footer_copyright', 'default_meta_title:default_meta_title',
          'default_meta_description:default_meta_description', 'hero_title:hero_title',
          'hero_subtitle:hero_subtitle', 'hero_badge_text:hero_badge_text',
          'hero_primary_cta_text:hero_primary_cta_text',
          'hero_secondary_cta_text:hero_secondary_cta_text', 'business_hours:business_hours']);
  PERFORM pg_temp.i18n_102_swap('site_popup', 'id', 'site_popup_translations', 'popup_id',
    ARRAY['title:title', 'description:description', 'highlight_text:highlight_text',
          'stats:stats', 'button_text:button_text', 'button_url:button_url']);

  CREATE TABLE i18n_backup_102.applied (
    applied_at timestamptz NOT NULL DEFAULT now(),
    note       text NOT NULL
  );
  INSERT INTO i18n_backup_102.applied (note)
    VALUES ('102: canonical içerik İngilizce, Türkçe çeviri satırları oluşturuldu');
END
$swap$;

COMMIT;

-- ---------------------------------------------------------------
-- DOĞRULAMA (uygulama sonrası, salt okunur):
--   SELECT * FROM i18n_backup_102.applied;
--   SELECT locale, count(*) FROM public.villa_translations GROUP BY 1;
--   SELECT v.id, v.description AS en_main, t.description AS tr
--     FROM public.villa v JOIN public.villa_translations t
--       ON t.villa_id = v.id AND t.locale = 'tr' LIMIT 5;
-- ---------------------------------------------------------------
