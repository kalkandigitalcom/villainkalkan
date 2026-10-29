-- ===============================================================
-- 102 GERİ ALMA — İçerik kaynak dilini Türkçeye döndürür
-- ===============================================================
-- 102_content_source_locale_en.sql'in tersidir. Yalnız o migration'ın
-- `i18n_backup_102` şemasındaki yedeklerini kullanır:
--   1) Canonical kolonlar yedekteki (102 öncesi, Türkçe) değerlere döner.
--   2) 102 sonrası oluşan TÜM locale='tr' çeviri satırları önce
--      `i18n_backup_102.<tablo>__tr_rollback_<zaman>` tablosuna kopyalanır
--      (102'den sonra admin'de girilen Türkçe düzenlemeler KAYBOLMAZ),
--      sonra çeviri tablosundan kaldırılır.
--   3) settings_translations / site_popup_translations CHECK kısıtları
--      102 öncesi hâline ('en','de') döner.
--   4) `i18n_backup_102.applied` işareti kaldırılır; diğer yedek
--      tabloları silinmez (elle incelenip silinebilir).
-- ⚠️ Eski (Türkçe-ana-dil) kod ile birlikte uygulanmalıdır.
-- ⚠️ 102'den sonra canonical (İngilizce) alanlarda yapılan admin
--    düzenlemeleri bu işlemle yedekteki değere döner; gerekiyorsa önce
--    `i18n_backup_102.<parent>__canonical_rollback_<zaman>` kopyası incelenmelidir.
--  Geri almadan sonra 102 yeniden uygulanacaksa önce `i18n_backup_102`
--  şeması arşivlenip boşaltılmalıdır (102 mevcut yedeğin üzerine yazmaz).
-- ===============================================================

BEGIN;

CREATE FUNCTION pg_temp.i18n_102_restore(
  p_parent text,
  p_pk     text,
  p_trans  text
) RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_backup text := p_parent || '__canonical';
  v_stamp  text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISS');
  v_set    text := '';
  v_col    text;
BEGIN
  IF to_regclass('i18n_backup_102.' || v_backup) IS NULL THEN
    RAISE NOTICE '102 down: % yedeği yok — atlandı', p_parent;
    RETURN;
  END IF;

  /* 102 sonrası canonical hâlinin de kopyası (inceleme için). */
  EXECUTE format(
    'CREATE TABLE i18n_backup_102.%I AS SELECT p.* FROM public.%I p',
    p_parent || '__canonical_rollback_' || v_stamp, p_parent
  );

  FOR v_col IN
    SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'i18n_backup_102' AND table_name = v_backup
       AND column_name <> p_pk
     ORDER BY ordinal_position
  LOOP
    IF v_set <> '' THEN v_set := v_set || ', '; END IF;
    v_set := v_set || format('%1$I = b.%1$I', v_col);
  END LOOP;

  IF v_set <> '' THEN
    EXECUTE format(
      'UPDATE public.%I p SET %s FROM i18n_backup_102.%I b WHERE b.%I = p.%I',
      p_parent, v_set, v_backup, p_pk, p_pk
    );
  END IF;

  IF to_regclass('public.' || p_trans) IS NOT NULL THEN
    EXECUTE format(
      'CREATE TABLE i18n_backup_102.%I AS SELECT * FROM public.%I WHERE locale = %L',
      p_trans || '__tr_rollback_' || v_stamp, p_trans, 'tr'
    );
    EXECUTE format('DELETE FROM public.%I WHERE locale = %L', p_trans, 'tr');
  END IF;
END
$fn$;

DO $restore$
BEGIN
  IF to_regclass('i18n_backup_102.applied') IS NULL THEN
    RAISE NOTICE '102 down: migration uygulanmamış — atlanıyor.';
    RETURN;
  END IF;

  PERFORM pg_temp.i18n_102_restore('villa', 'id', 'villa_translations');
  PERFORM pg_temp.i18n_102_restore('villa_types', 'id', 'villa_type_translations');
  PERFORM pg_temp.i18n_102_restore('villa_features', 'id', 'villa_feature_translations');
  PERFORM pg_temp.i18n_102_restore('rule_items', 'id', 'rule_item_translations');
  PERFORM pg_temp.i18n_102_restore('price_include_items', 'id', 'price_include_item_translations');
  PERFORM pg_temp.i18n_102_restore('pages', 'id', 'page_translations');
  PERFORM pg_temp.i18n_102_restore('faqs', 'id', 'faq_translations');
  PERFORM pg_temp.i18n_102_restore('menu', 'id', 'menu_translations');
  PERFORM pg_temp.i18n_102_restore('payment_methods', 'id', 'payment_method_translations');
  PERFORM pg_temp.i18n_102_restore('blog_posts', 'id', 'blog_post_translations');
  PERFORM pg_temp.i18n_102_restore('settings', 'id', 'settings_translations');
  PERFORM pg_temp.i18n_102_restore('site_popup', 'id', 'site_popup_translations');

  IF to_regclass('public.settings_translations') IS NOT NULL THEN
    ALTER TABLE public.settings_translations
      DROP CONSTRAINT IF EXISTS settings_translations_locale_check;
    ALTER TABLE public.settings_translations
      ADD CONSTRAINT settings_translations_locale_check
      CHECK (locale IN ('en', 'de'));
  END IF;
  IF to_regclass('public.site_popup_translations') IS NOT NULL THEN
    ALTER TABLE public.site_popup_translations
      DROP CONSTRAINT IF EXISTS site_popup_translations_locale_check;
    ALTER TABLE public.site_popup_translations
      ADD CONSTRAINT site_popup_translations_locale_check
      CHECK (locale IN ('en', 'de'));
  END IF;

  DROP TABLE i18n_backup_102.applied;
END
$restore$;

COMMIT;
