/* ===============================================================
   🛡️ PUBLIC ÇOKLU DİL — TAM KAPSAM (blog + token sayfaları)
   ===============================================================
   Kapsam:
     • `/en/blog`, `/en/blog/[slug]`, `/en/liste/[token]`,
       `/en/v/[token]` route dosyalarının VARLIĞI + locale gate
     • `blog`, `sharedList`, `privateVilla` dictionary namespace'lerinin
       TR/EN bütünlüğü ve TR byte-identity
     • `blog_post` translation entity'sinin registry'de olması
     • locale-switch allowlist: blog/liste/v için slug/token korunur
     • Source-lock: yeni gövdelerde hardcoded TR kullanıcı metni YOK

   Mock convention `public-locale-completion.test.tsx` ile AYNI —
   yeni bir test mimarisi İCAT EDİLMEDİ.
=============================================================== */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import { TRANSLATION_ENTITY_CONFIG } from "@/lib/i18n/translations.types";
import { getLocaleSwitchTargets } from "@/lib/i18n/locale-switch.helper";

const LOCALES: Locale[] = ["tr", "en"];

/* ===============================================================
   1) ROUTE DOSYALARI — her public route'un TR/EN karşılığı
   (DE desteği kaldırıldı → `/de` route ağacı YOK)
   =============================================================== */

const ROUTE_PAIRS: Array<[string, string]> = [
  ["app/(public)/blog/page.tsx", "app/(public)/en/blog/page.tsx"],
  ["app/(public)/blog/[slug]/page.tsx", "app/(public)/en/blog/[slug]/page.tsx"],
  ["app/(public)/liste/[token]/page.tsx", "app/(public)/en/liste/[token]/page.tsx"],
  ["app/(public)/v/[token]/page.tsx", "app/(public)/en/v/[token]/page.tsx"],
];

describe("1) blog + token sayfalarının TR/EN route dosyaları var", () => {
  it.each(ROUTE_PAIRS)("%s ↔ EN", (tr, en) => {
    for (const p of [tr, en]) {
      expect(existsSync(resolve(process.cwd(), p)), p).toBe(true);
    }
  });

  it("DE route ağacı YOK (DE desteği kaldırıldı)", () => {
    expect(existsSync(resolve(process.cwd(), "app/(public)/de"))).toBe(false);
  });

  it("EN route'ları locale gate + setRequestLocale çağırıyor", () => {
    for (const [, en] of ROUTE_PAIRS) {
      const src = readFileSync(resolve(process.cwd(), en), "utf8");
      expect(src, en).toContain("requirePublicLocaleEnabled");
      expect(src, en).toContain("setRequestLocale");
    }
  });

  it("EN route'ları TR ile AYNI gövdeyi kullanıyor (kopya JSX yok)", () => {
    const bodies: Record<string, string> = {
      "blog/page.tsx": "BlogIndexPageBody",
      "blog/[slug]/page.tsx": "BlogDetailPageBody",
      "liste/[token]/page.tsx": "SharedListPageBody",
      "v/[token]/page.tsx": "PrivateVillaPageBody",
    };
    for (const [key, body] of Object.entries(bodies)) {
      for (const prefix of ["app/(public)/", "app/(public)/en/"]) {
        const src = readFileSync(resolve(process.cwd(), prefix + key), "utf8");
        expect(src, prefix + key).toContain(body);
      }
    }
  });
});

/* ===============================================================
   2) DICTIONARY — TR/EN bütünlüğü
   =============================================================== */

function leafPaths(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leafPaths(v, prefix ? `${prefix}.${k}` : k)
  );
}

const NEW_NAMESPACES = ["blog", "sharedList", "privateVilla"] as const;

describe("2) yeni dictionary namespace'leri iki dilde eksiksiz", () => {
  it.each(NEW_NAMESPACES)("%s — TR/EN key ağacı birebir aynı", (ns) => {
    const trPaths = leafPaths(getDictionary("tr")[ns]).sort();
    const enPaths = leafPaths(getDictionary("en")[ns]).sort();
    expect(enPaths).toEqual(trPaths);
    expect(trPaths.length).toBeGreaterThan(0);
  });

  it.each(NEW_NAMESPACES)("%s — hiçbir locale'de boş değer yok", (ns) => {
    for (const locale of LOCALES) {
      const values = Object.values(
        getDictionary(locale)[ns] as Record<string, string>
      );
      for (const v of values) {
        expect(typeof v, `${locale}.${ns}`).toBe("string");
        expect(v.trim().length, `${locale}.${ns}`).toBeGreaterThan(0);
      }
    }
  });

  it.each(NEW_NAMESPACES)("%s — EN değerleri TR'den FARKLI", (ns) => {
    const tr = getDictionary("tr")[ns] as Record<string, string>;
    const en = getDictionary("en")[ns] as Record<string, string>;
    /* "Blog" gibi dile bağımsız kelimeler aynı kalabilir; en az yarısı
       farklı olmalı — gerçekten çevrilmiş olduğunun kanıtı. */
    const keys = Object.keys(tr);
    const enDiff = keys.filter((k) => en[k] !== tr[k]).length;
    expect(enDiff / keys.length).toBeGreaterThan(0.5);
  });
});

/* ===============================================================
   3) TR BYTE-IDENTITY — eski hardcoded metinler dictionary'de AYNEN
   =============================================================== */

describe("3) TR değerleri eski hardcoded metinlerle BİREBİR", () => {
  it("blog namespace", () => {
    const d = getDictionary("tr").blog;
    expect(d.metaTitle).toBe("Blog");
    expect(d.heroTitle).toBe("Blog & Rehber");
    expect(d.listEmpty).toBe("Henüz blog yazısı yayınlanmadı.");
    expect(d.detailNotFoundTitle).toBe("Yazı bulunamadı");
    expect(d.contentComing).toBe("İçerik yakında.");
    expect(d.breadcrumbHome).toBe("Ana sayfa");
  });

  it("sharedList namespace", () => {
    const d = getDictionary("tr").sharedList;
    expect(d.eyebrow).toBe("Sizin için özel seçildi");
    expect(d.titleFallback).toBe("Sizinle paylaşılan villalar");
    expect(d.villaUnit).toBe("villa");
    expect(d.footerCta).toBe("Tüm villaları keşfet");
  });

  it("privateVilla namespace", () => {
    const d = getDictionary("tr").privateVilla;
    expect(d.metaInvalidTitle).toBe("Bağlantı geçersiz");
    expect(d.metaTitleFallback).toBe("Özel Bağlantı");
    expect(d.badge).toBe("Özel Paylaşım");
    expect(d.badgeNote).toBe("Sadece bağlantıyı bilen kişilere açık");
    expect(d.dimensionsCaption).toBe("Genişlik × Uzunluk × Derinlik");
  });
});

/* ===============================================================
   4) DB TRANSLATION — blog_post entity'si registry'de
   =============================================================== */

describe("4) blog_post translation entity", () => {
  it("registry'de doğru tablo/parent kolonuyla kayıtlı", () => {
    expect(TRANSLATION_ENTITY_CONFIG.blog_post).toEqual({
      table: "blog_post_translations",
      parentIdColumn: "blog_post_id",
    });
  });

  it("migration 089 dosyası var ve blog_posts tablosuna DOKUNMUYOR", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "db/migrations/089_blog_post_translations.sql"),
      "utf8"
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.blog_post_translations");
    expect(sql).toContain("UNIQUE (blog_post_id, locale)");
    expect(sql).toContain("CHECK (locale IN ('tr', 'en', 'de'))");
    /* Canonical TR veriye dokunan hiçbir DML olmamalı. */
    expect(/ALTER TABLE\s+public\.blog_posts/i.test(sql)).toBe(false);
    expect(/UPDATE\s+public\.blog_posts/i.test(sql)).toBe(false);
    expect(/INSERT\s+INTO\s+public\.blog_posts/i.test(sql)).toBe(false);
    expect(/DELETE\s+FROM\s+public\.blog_posts/i.test(sql)).toBe(false);
  });

  it("admin giriş yüzeyi var (service + action + panel)", () => {
    for (const p of [
      "app/services/blog-translation.service.ts",
      "app/(admin)/maki-admin/blog/blog-translations.action.ts",
      "app/(admin)/maki-admin/blog/BlogTranslationsCard.tsx",
    ]) {
      expect(existsSync(resolve(process.cwd(), p)), p).toBe(true);
    }
  });

  /* 🛡️ MIGRATION 090 — villa BAŞINA mesafe çevirisi özelliği kaldırıldı.
     Eski "admin giriş yüzeyi var" testinin YERİNE, özelliğin GERÇEKTEN
     kaldırıldığını doğrulayan ters yönlü guard konuldu. */
  it("villa_distance çeviri özelliği tamamen kaldırıldı (dosya + registry)", () => {
    for (const p of [
      "app/services/villa-distance-translation.service.ts",
      "app/(admin)/maki-admin/villas/[id]/_components/villa-distance-translations.action.ts",
      "app/(admin)/maki-admin/villas/[id]/_components/VillaDistanceTranslationsCard.tsx",
    ]) {
      expect(existsSync(resolve(process.cwd(), p)), p).toBe(false);
    }
    expect(
      Object.keys(TRANSLATION_ENTITY_CONFIG)
    ).not.toContain("villa_distance");
  });

  it("migration 090 yalnız çeviri tablosunu düşürür, villa_distances'a DOKUNMAZ", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "db/migrations/090_drop_villa_distance_translations.sql"
      ),
      "utf8"
    );
    /* Yorum satırlarını at — yalnız gerçek DDL denetlenir. */
    const code = sql
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(code).toContain(
      "DROP TABLE IF EXISTS public.villa_distance_translations"
    );
    /* villa_distances (parent) ve ortak trigger fonksiyonu KORUNUR. */
    expect(/DROP\s+TABLE[^;]*public\.villa_distances\b/i.test(code)).toBe(false);
    expect(/DELETE\s+FROM\s+public\.villa_distances\b/i.test(code)).toBe(false);
    expect(/UPDATE\s+public\.villa_distances\b/i.test(code)).toBe(false);
    expect(/TRUNCATE[^;]*villa_distances\b/i.test(code)).toBe(false);
    expect(/ALTER\s+TABLE[^;]*villa_distances\b/i.test(code)).toBe(false);
    expect(/DROP\s+FUNCTION[^;]*trg_touch_updated_at/i.test(code)).toBe(false);
  });
});

/* ===============================================================
   5) LOCALE SWITCH — slug/token/query KAYBOLMAZ
   =============================================================== */

describe("5) locale switcher blog + token sayfalarında segmenti korur", () => {
  it.each([
    ["/blog", "/blog", "/en/blog"],
    ["/blog/kas-rehberi", "/blog/kas-rehberi", "/en/blog/kas-rehberi"],
    ["/en/liste/AbC-123_x", "/liste/AbC-123_x", "/en/liste/AbC-123_x"],
    ["/en/v/tok_9Z", "/v/tok_9Z", "/en/v/tok_9Z"],
  ])("%s", (path, tr, en) => {
    expect(getLocaleSwitchTargets(path)).toEqual({ tr, en });
  });

  it("query string AYNEN korunur", () => {
    expect(getLocaleSwitchTargets("/v/tok_9Z", "start=2026-06-04&end=2026-06-11")).toEqual({
      tr: "/v/tok_9Z?start=2026-06-04&end=2026-06-11",
      en: "/en/v/tok_9Z?start=2026-06-04&end=2026-06-11",
    });
  });
});

/* ===============================================================
   6) SOURCE-LOCK — yeni gövdelerde hardcoded TR kullanıcı metni yok
   =============================================================== */

const SOURCE_LOCKED = [
  "app/components/blog/BlogIndexPageBody.tsx",
  "app/components/blog/BlogDetailPageBody.tsx",
  "app/components/blog/blog-metadata.ts",
  "app/components/private-villa/PrivateVillaPageBody.tsx",
  "app/components/private-villa/private-villa-metadata.ts",
  "app/(public)/blog/page.tsx",
  "app/(public)/blog/[slug]/page.tsx",
  "app/(public)/liste/[token]/page.tsx",
  "app/(public)/v/[token]/page.tsx",
];

describe("6) source-lock — yeni public gövdelerde hardcoded TR metin yok", () => {
  it.each(SOURCE_LOCKED)("%s", (p) => {
    const raw = readFileSync(resolve(process.cwd(), p), "utf8");
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    const offending = src
      .split("\n")
      .filter((l) => /[çğıöşüÇĞİÖŞÜ]/.test(l) && !l.includes("console."));
    expect(offending).toEqual([]);
  });

  it("SharedListPageBody — yalnız console log'larda TR kalabilir", () => {
    const raw = readFileSync(
      resolve(process.cwd(), "app/components/shared-list/SharedListPageBody.tsx"),
      "utf8"
    );
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    const lines = src.split("\n");
    const offending = lines.filter((l, i) => {
      if (!/[çğıöşüÇĞİÖŞÜ]/.test(l)) return false;
      /* console.warn(\n  "…"\n) — çok satırlı çağrıyı da kapsa. */
      const window = lines.slice(Math.max(0, i - 3), i + 1).join("\n");
      return !window.includes("console.");
    });
    expect(offending).toEqual([]);
  });
});
