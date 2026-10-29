/* ===============================================================
   🛡️ İNGİLİZCE ANA DİL / TÜRKÇE ÇEVİRİ — SİSTEM KİLİTLERİ
   ===============================================================
   Kapsam:
     A) Migration 102 (canonical → İngilizce, Türkçe → çeviri satırı)
        güvenlik sözleşmesi: yedek şeması, ön kontroller, geri alma
        dosyasının migration klasörü DIŞINDA durması.
     B) Admin çeviri ekranları yalnız 'tr' yazar (EN = ana içerik).
     C) Admin/mail biçimlendirmesi (para/ülke) Türkçe kalır —
        GBP/kur/rezervasyon akışlarının biçimi DEĞİŞMEDİ.
   =============================================================== */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { formatCurrency, formatDisplayPrice } from "@/lib/currency";
import { ADMIN_UI_LOCALE, DEFAULT_LOCALE } from "@/lib/i18n/config";

const read = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const exists = (rel: string) => fs.existsSync(path.join(process.cwd(), rel));
const stripSqlComments = (sql: string) => sql.replace(/^\s*--.*$/gm, "");

const MIGRATION = "db/migrations/102_content_source_locale_en.sql";
const ROLLBACK = "db/rollback/102_content_source_locale_en.down.sql";

describe("A) migration 102 — içerik kaynak dili EN", () => {
  const sql = read(MIGRATION);
  const code = stripSqlComments(sql);

  it("tek transaction içinde çalışır", () => {
    expect(code).toMatch(/\bBEGIN;/);
    expect(code).toMatch(/\bCOMMIT;/);
  });

  it("değişiklikten ÖNCE tam yedek alır (i18n_backup_102 şeması)", () => {
    expect(code).toMatch(/CREATE SCHEMA IF NOT EXISTS i18n_backup_102;/);
    expect(code).toMatch(/__canonical/);
    expect(code).toMatch(/__before/);
  });

  it("zaten uygulanmışsa tekrar çalışmaz (applied işareti)", () => {
    expect(code).toMatch(/to_regclass\('i18n_backup_102\.applied'\) IS NOT NULL/);
    expect(code).toMatch(/CREATE TABLE i18n_backup_102\.applied/);
  });

  it("hedef tabloda locale='tr' satırı varsa DURUR (üzerine yazmaz)", () => {
    expect(code).toMatch(/RAISE EXCEPTION '102: public\.% tablosunda % adet locale=''tr''/);
  });

  it("veri SİLMEZ — DELETE / DROP TABLE / TRUNCATE yok", () => {
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
  });

  it("canonical yalnız DOLU İngilizce çeviriden güncellenir (boş EN Türkçeyi silmez)", () => {
    expect(code).toMatch(/t\.locale = %L/);
    expect(code).toMatch(/btrim/i);
  });

  it("tüm çeviri destekli modülleri kapsar", () => {
    for (const table of [
      "villa_translations",
      "villa_type_translations",
      "villa_feature_translations",
      "rule_item_translations",
      "price_include_item_translations",
      "page_translations",
      "faq_translations",
      "menu_translations",
      "payment_method_translations",
      "blog_post_translations",
      "settings_translations",
      "site_popup_translations",
    ]) {
      expect(code, table).toContain(`'${table}'`);
    }
  });

  it("geri alma betiği migration klasörü DIŞINDA (otomatik çalıştırılmaz) ve yedekten döner", () => {
    expect(exists(ROLLBACK)).toBe(true);
    expect(exists("db/migrations/102_content_source_locale_en.down.sql")).toBe(false);
    const down = stripSqlComments(read(ROLLBACK));
    expect(down).toMatch(/i18n_backup_102/);
    expect(down).toMatch(/__tr_rollback_/);
    expect(sql).toContain(ROLLBACK);
  });
});

describe("B) admin çeviri ekranları — yalnız Türkçe çeviri yazılır", () => {
  const PANELS = [
    "app/(admin)/maki-admin/blog/BlogTranslationsCard.tsx",
    "app/(admin)/maki-admin/features/FeatureTranslationsPanel.tsx",
    "app/(admin)/maki-admin/menu/MenuTranslationsPanel.tsx",
    "app/(admin)/maki-admin/pages/[id]/PageTranslationsCard.tsx",
    "app/(admin)/maki-admin/payment-methods/PaymentMethodTranslationsPanel.tsx",
    "app/(admin)/maki-admin/price-includes/PriceIncludeTranslationsPanel.tsx",
    "app/(admin)/maki-admin/rules/RuleTranslationsPanel.tsx",
    "app/(admin)/maki-admin/types/TypeTranslationsPanel.tsx",
    "app/(admin)/maki-admin/villas/[id]/_components/VillaTranslationsCard.tsx",
  ];

  it.each(PANELS)("%s → yazılabilir dil yalnız 'tr', ana içerik English", (rel) => {
    const src = read(rel);
    expect(src).toMatch(/WritableLocale = "tr"/);
    expect(src).toContain('tr: "Türkçe"');
    expect(src).toMatch(/English[ —(]+ana içerik|İngilizce ana içerik/);
  });
});

describe("C) admin / e-posta biçimlendirmesi DEĞİŞMEDİ", () => {
  it("public varsayılan dil EN, admin arayüz dili TR", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(ADMIN_UI_LOCALE).toBe("tr");
  });

  it("formatCurrency locale verilmezse Türkçe biçimi kullanır (admin/mail/voucher)", () => {
    expect(formatCurrency(1234.5, "TRY")).toBe(formatCurrency(1234.5, "TRY", "tr"));
    expect(formatCurrency(1000, "GBP")).toBe(formatCurrency(1000, "GBP", "tr"));
  });

  it("formatDisplayPrice locale verilmezse Türkçe biçimi kullanır", () => {
    expect(formatDisplayPrice(1000, "GBP")).toBe(
      formatDisplayPrice(1000, "GBP", "tr")
    );
  });
});
