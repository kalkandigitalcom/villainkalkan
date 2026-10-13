/* ===============================================================
   🛡️ PHASE 10C — LOCALE SWITCH HELPER: TESTLER
   ===============================================================
   Hedef: lib/i18n/locale-switch.helper.ts (hasLocaleRoute,
   getLocaleSwitchTargets). Kullanıcının audit onayında verdiği tüm
   örnek senaryolar (ana sayfa, villa detay, rezervasyon, locale
   karşılığı olmayan route'lar için fallback) burada birebir
   doğrulanır. Saf fonksiyonlar — DB/network/React'e dokunulmaz.
   =============================================================== */

import { describe, it, expect } from "vitest";

import {
  hasLocaleRoute,
  getLocaleSwitchTargets,
} from "@/lib/i18n/locale-switch.helper";

describe("hasLocaleRoute", () => {
  it("1) '/' (ana sayfa) → true (Phase 10C stub route'ları var)", () => {
    expect(hasLocaleRoute("/")).toBe(true);
  });

  it("2) '/arama' → true", () => {
    expect(hasLocaleRoute("/arama")).toBe(true);
  });

  it("3) '/kiralik-villalar' → true", () => {
    expect(hasLocaleRoute("/kiralik-villalar")).toBe(true);
  });

  it("4) '/kiralik-villa/test-villa' (slug'lı) → true", () => {
    expect(hasLocaleRoute("/kiralik-villa/test-villa")).toBe(true);
  });

  it("5) '/rezervasyon/test-villa' (slug'lı) → true", () => {
    expect(hasLocaleRoute("/rezervasyon/test-villa")).toBe(true);
  });

  it("6) '/kiralik-villa/' (slug'sız, bare prefix) → false", () => {
    expect(hasLocaleRoute("/kiralik-villa/")).toBe(false);
  });

  it("7) '/kiralik-villa' (trailing slash yok, slug yok) → false", () => {
    expect(hasLocaleRoute("/kiralik-villa")).toBe(false);
  });

  /* 🛡️ PUBLIC ÇOKLU DİL TAMAMLAMA — `/en/teklif-al` GERÇEK route
     dosyaları eklendi (ortak `OfferPageBody`) → allowlist'e girdi. */
  it("8) '/teklif-al' → true (EN route'ları var)", () => {
    expect(hasLocaleRoute("/teklif-al")).toBe(true);
  });

  /* 🛡️ PUBLIC ÇOKLU DİL TAMAMLAMA — `/en/blog` ve
     `/en/blog/[slug]` GERÇEK route dosyaları eklendi (ortak
     `BlogIndexPageBody` / `BlogDetailPageBody` + migration 089
     `blog_post_translations`) → beklenen değer false → true. */
  it("9) '/blog' → true (EN route'ları var)", () => {
    expect(hasLocaleRoute("/blog")).toBe(true);
  });

  it("9b) '/blog/bir-yazi' → true (detay route'ları var)", () => {
    expect(hasLocaleRoute("/blog/bir-yazi")).toBe(true);
  });

  it("9c) '/bloglar' → false (prefix ile YANLIŞLIKLA eşleşmez)", () => {
    expect(hasLocaleRoute("/bloglar")).toBe(false);
  });

  /* 🛡️ PUBLIC ÇOKLU DİL TAMAMLAMA — `/en/favoriler`. */
  it("10) '/favoriler' → true (EN route'ları var)", () => {
    expect(hasLocaleRoute("/favoriler")).toBe(true);
  });

  it("10b) '/favoriler/paylas/<token>' → true (prefixed allowlist)", () => {
    expect(hasLocaleRoute("/favoriler/paylas/abc123")).toBe(true);
  });

  it("10c) '/kisa-sureli-tarihler/haziran/2' → true (prefixed allowlist)", () => {
    expect(hasLocaleRoute("/kisa-sureli-tarihler/haziran/2")).toBe(true);
  });

  /* 🛡️ `/en/iletisim` GERÇEK route dosyaları eklendi (ortak
     `ContactPageBody`) → allowlist'e girdi; artık fallback DEĞİL. */
  it("11) '/iletisim' → true (EN route'ları var)", () => {
    expect(hasLocaleRoute("/iletisim")).toBe(true);
  });

  it("12) '/liste' → false", () => {
    expect(hasLocaleRoute("/liste")).toBe(false);
  });

  /* 🛡️ PUBLIC ÇOKLU DİL TAMAMLAMA — `/en/rezervasyon-kontrol`.
     ⚠️ Eşleşme `/rezervasyon/` PREFIX'inden değil, KENDİ exact
     kaydından gelir (aşağıdaki 13b bunu doğrular). */
  it("13) '/rezervasyon-kontrol' → true (EN route'ları var)", () => {
    expect(hasLocaleRoute("/rezervasyon-kontrol")).toBe(true);
  });

  it("13b) '/rezervasyon-kontrolX' → false (prefix ile YANLIŞLIKLA eşleşmez)", () => {
    expect(hasLocaleRoute("/rezervasyon-kontrolX")).toBe(false);
  });

  /* 🛡️ PUBLIC ÇOKLU DİL TAMAMLAMA — `/en/v/[token]` ve
     `/en/liste/[token]` GERÇEK route dosyaları eklendi. Sayfalar
     `noindex`'tir ama kullanıcı linke EN ile de ulaşabildiği için
     dil değiştirici çalışmalıdır → beklenen değer false → true. */
  it("14) '/v/abc123' → true (EN route'ları var)", () => {
    expect(hasLocaleRoute("/v/abc123")).toBe(true);
  });

  it("14b) '/liste/abc123' → true (EN route'ları var)", () => {
    expect(hasLocaleRoute("/liste/abc123")).toBe(true);
  });

  it("14c) '/v/' → false (token YOKSA eşleşmez)", () => {
    expect(hasLocaleRoute("/v/")).toBe(false);
  });

  /* 🛡️ PHASE 12D — /en/p/[slug] route'u EKLENDİ;
     bu yüzden beklenen değer false → true olarak GÜNCELLENDİ. */
  it("15) '/p/some-slug' (slug'lı) → true", () => {
    expect(hasLocaleRoute("/p/some-slug")).toBe(true);
  });

  it("15b) '/p/' (slug'sız, bare prefix) → false", () => {
    expect(hasLocaleRoute("/p/")).toBe(false);
  });

  it("15c) '/p' → false", () => {
    expect(hasLocaleRoute("/p")).toBe(false);
  });

  it("16) '/kisa-sureli-tarihler' → false", () => {
    expect(hasLocaleRoute("/kisa-sureli-tarihler")).toBe(false);
  });
});

describe("getLocaleSwitchTargets", () => {
  it("1) '/' → tr:'/', en:'/en'", () => {
    expect(getLocaleSwitchTargets("/")).toEqual({
      tr: "/",
      en: "/en",
    });
  });

  it("2) null pathname → '/' ile aynı davranır", () => {
    expect(getLocaleSwitchTargets(null)).toEqual({
      tr: "/",
      en: "/en",
    });
  });

  it("3) undefined pathname → '/' ile aynı davranır", () => {
    expect(getLocaleSwitchTargets(undefined)).toEqual({
      tr: "/",
      en: "/en",
    });
  });

  it("4) '/en' (EN ana sayfa) → tr:'/', en:'/en'", () => {
    expect(getLocaleSwitchTargets("/en")).toEqual({
      tr: "/",
      en: "/en",
    });
  });

  it("5) DE desteği kaldırıldı — '/de/kiralik-villalar' locale route DEĞİL, fallback'e düşer ve 'de' hedefi ÜRETİLMEZ", () => {
    const t = getLocaleSwitchTargets("/de/kiralik-villalar");
    expect(t).toEqual({ tr: "/", en: "/en" });
    expect("de" in t).toBe(false);
  });

  it("6) '/kiralik-villalar' → 2 locale varyantı (gerçek route)", () => {
    expect(getLocaleSwitchTargets("/kiralik-villalar")).toEqual({
      tr: "/kiralik-villalar",
      en: "/en/kiralik-villalar",
    });
  });

  it("7) '/kiralik-villa/test-villa' → 2 locale varyantı", () => {
    expect(getLocaleSwitchTargets("/kiralik-villa/test-villa")).toEqual({
      tr: "/kiralik-villa/test-villa",
      en: "/en/kiralik-villa/test-villa",
    });
  });

  it("8) '/en/kiralik-villa/test-villa' (zaten EN prefixli) → aynı 2 varyant", () => {
    expect(getLocaleSwitchTargets("/en/kiralik-villa/test-villa")).toEqual({
      tr: "/kiralik-villa/test-villa",
      en: "/en/kiralik-villa/test-villa",
    });
  });

  it("10) '/rezervasyon/test-villa' → 2 locale varyantı", () => {
    expect(getLocaleSwitchTargets("/rezervasyon/test-villa")).toEqual({
      tr: "/rezervasyon/test-villa",
      en: "/en/rezervasyon/test-villa",
    });
  });

  it("11) '/teklif-al' → locale prefix'li hedefler", () => {
    expect(getLocaleSwitchTargets("/teklif-al")).toEqual({
      tr: "/teklif-al",
      en: "/en/teklif-al",
    });
  });

  it("12) '/en/teklif-al' → EN '/en/teklif-al', TR '/teklif-al'", () => {
    const targets = getLocaleSwitchTargets("/en/teklif-al");
    expect(targets.tr).toBe("/teklif-al");
    expect(targets.en).toBe("/en/teklif-al");
  });

  it("13) '/en/blog' → locale prefix'li hedefler (artık EN route'u var)", () => {
    expect(getLocaleSwitchTargets("/en/blog")).toEqual({
      tr: "/blog",
      en: "/en/blog",
    });
  });

  it("13c) '/en/blog/bir-yazi' → slug AYNEN korunur", () => {
    expect(getLocaleSwitchTargets("/en/blog/bir-yazi")).toEqual({
      tr: "/blog/bir-yazi",
      en: "/en/blog/bir-yazi",
    });
  });

  it("14) '/rezervasyon-kontrol' → locale prefix'li hedefler", () => {
    expect(getLocaleSwitchTargets("/rezervasyon-kontrol")).toEqual({
      tr: "/rezervasyon-kontrol",
      en: "/en/rezervasyon-kontrol",
    });
  });

  it("15) '/favoriler' → locale prefix'li hedefler", () => {
    expect(getLocaleSwitchTargets("/favoriler")).toEqual({
      tr: "/favoriler",
      en: "/en/favoriler",
    });
  });

  /* 🛡️ Dinamik segmentler (token / ay / gece) AYNEN korunur. */
  it("15b) '/en/favoriler/paylas/abc123' → token korunur", () => {
    expect(getLocaleSwitchTargets("/en/favoriler/paylas/abc123")).toEqual({
      tr: "/favoriler/paylas/abc123",
      en: "/en/favoriler/paylas/abc123",
    });
  });

  it("15c) '/en/kisa-sureli-tarihler/haziran/2' → ay/gece korunur", () => {
    expect(
      getLocaleSwitchTargets("/en/kisa-sureli-tarihler/haziran/2")
    ).toEqual({
      tr: "/kisa-sureli-tarihler/haziran/2",
      en: "/en/kisa-sureli-tarihler/haziran/2",
    });
  });

  it("16) '/v/abc123' → token AYNEN korunur", () => {
    expect(getLocaleSwitchTargets("/v/abc123")).toEqual({
      tr: "/v/abc123",
      en: "/en/v/abc123",
    });
  });

  it("16b) '/en/liste/abc123' → token AYNEN korunur", () => {
    expect(getLocaleSwitchTargets("/en/liste/abc123")).toEqual({
      tr: "/liste/abc123",
      en: "/en/liste/abc123",
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
   🛡️ QUERY STRING KORUMA — `/arama` dil değiştirme düzeltmesi
   ═══════════════════════════════════════════════════════════════
   BEKLENEN DAVRANIŞ: locale değişirken YALNIZ locale route segmenti
   değişir; mevcut query string eksiksiz ve AYNEN korunur —
     - parametre adları yeniden adlandırılmaz,
     - değerler locale'e göre ÇEVRİLMEZ (`villa-turleri` canonical
       slug/token olarak kalır),
     - URL encoding bozulmaz,
     - parametre sırası korunur.
   Allowlist kararı HÂLÂ yalnız PATH üzerinden verilir; query
   `hasLocaleRoute` sonucunu ETKİLEMEZ. */
describe("getLocaleSwitchTargets — query string koruma", () => {
  /** Kullanıcının bildirdiği gerçek örnek query — birebir. */
  const Q = "villa-turleri=2027-kiralik-villalar%2Cmuhafazakar-villalar&flexible=3";

  it("Q1) '/arama' + query → '/en/arama' + AYNI query", () => {
    expect(getLocaleSwitchTargets("/arama", Q)).toEqual({
      tr: `/arama?${Q}`,
      en: `/en/arama?${Q}`,
    });
  });

  it("Q2) '/en/arama' + query → '/arama' + AYNI query", () => {
    expect(getLocaleSwitchTargets("/en/arama", Q)).toEqual({
      tr: `/arama?${Q}`,
      en: `/en/arama?${Q}`,
    });
  });

  it("Q4) birden fazla parametre — adları/değerleri/SIRASI korunur", () => {
    const multi = "regions=fethiye&guests=6&start=2026-07-01&end=2026-07-08&page=2&sort=price-asc";
    const t = getLocaleSwitchTargets("/arama", multi);
    expect(t.en).toBe(`/en/arama?${multi}`);
    expect(t.tr).toBe(`/arama?${multi}`);
  });

  it("Q5) `villa-turleri` virgüllü değerleri canonical slug olarak kalır (çeviri YOK)", () => {
    const q = "villa-turleri=2027-kiralik-villalar%2Cmuhafazakar-villalar";
    const t = getLocaleSwitchTargets("/en/arama", q);
    expect(t.en).toBe(`/en/arama?${q}`);
    expect(t.en).toContain("2027-kiralik-villalar%2Cmuhafazakar-villalar");
    /* Slug'lar hiçbir locale'de değişmez — 2 hedefte de AYNI token. */
    expect(t.tr.endsWith(q)).toBe(true);
  });

  it("Q6) `flexible` parametresi korunur", () => {
    expect(getLocaleSwitchTargets("/arama", "flexible=3")).toEqual({
      tr: "/arama?flexible=3",
      en: "/en/arama?flexible=3",
    });
  });

  it("Q7) query YOK (undefined / '' / '?') → MEVCUT davranış birebir (soru işareti eklenmez)", () => {
    const expected = { tr: "/arama", en: "/en/arama" };
    expect(getLocaleSwitchTargets("/arama")).toEqual(expected);
    expect(getLocaleSwitchTargets("/arama", "")).toEqual(expected);
    expect(getLocaleSwitchTargets("/arama", "?")).toEqual(expected);
    expect(getLocaleSwitchTargets("/arama", null)).toEqual(expected);
  });

  it("Q8) URL encoding BOZULMAZ — percent-encoded değerler decode/re-encode edilmez", () => {
    const q = "regions=k%C3%B6ycegiz%2Csarigerme&q=deniz%20manzara";
    const t = getLocaleSwitchTargets("/arama", q);
    expect(t.en).toBe(`/en/arama?${q}`);
    expect(t.en).toContain("k%C3%B6ycegiz%2Csarigerme");
    expect(t.en).toContain("deniz%20manzara");
    expect(t.en).not.toContain("köycegiz");
  });

  it("Q9) DİĞER locale route'ları etkilenmez", () => {
    /* (a) allowlist'teki route → query AYNEN korunur */
    expect(getLocaleSwitchTargets("/teklif-al", "foo=bar")).toEqual({
      tr: "/teklif-al?foo=bar",
      en: "/en/teklif-al?foo=bar",
    });
    /* (a2) `/blog` artık allowlist'te → query AYNEN korunur */
    expect(getLocaleSwitchTargets("/en/blog", "x=1")).toEqual({
      tr: "/blog?x=1",
      en: "/en/blog?x=1",
    });
    /* (a3) gerçek fallback (locale karşılığı YOK) → query EKLENMEZ */
    expect(getLocaleSwitchTargets("/bilinmeyen-sayfa", "x=1")).toEqual({
      tr: "/",
      en: "/en",
    });

    /* (b) query'siz çağrılar — Phase 10C çıktısı BİREBİR aynı */
    expect(getLocaleSwitchTargets("/")).toEqual({ tr: "/", en: "/en" });
    expect(getLocaleSwitchTargets("/kiralik-villa/test-villa")).toEqual({
      tr: "/kiralik-villa/test-villa",
      en: "/en/kiralik-villa/test-villa",
    });

    /* (c) query'li diğer allowlist route'ları da aynı kuralı izler */
    expect(getLocaleSwitchTargets("/kiralik-villa/test-villa", "guests=4").en).toBe(
      "/en/kiralik-villa/test-villa?guests=4"
    );
    expect(getLocaleSwitchTargets("/p/hakkimizda", "utm=x").en).toBe(
      "/en/p/hakkimizda?utm=x"
    );
  });

  it("Q10) '?' önekli ve öneksiz search AYNI sonucu verir", () => {
    expect(getLocaleSwitchTargets("/arama", `?${Q}`)).toEqual(
      getLocaleSwitchTargets("/arama", Q)
    );
  });

  it("Q11) pathname içine gömülü query — allowlist eşleşmesi BOZULMAZ (savunmacı)", () => {
    expect(getLocaleSwitchTargets("/arama?flexible=3")).toEqual({
      tr: "/arama?flexible=3",
      en: "/en/arama?flexible=3",
    });
    expect(getLocaleSwitchTargets("/en/arama?flexible=3").tr).toBe("/arama?flexible=3");
  });

  it("Q12) `hasLocaleRoute` query'den ETKİLENMEZ (yalnız path allowlist'i)", () => {
    expect(hasLocaleRoute("/arama")).toBe(true);
    /* Ham query'li string allowlist'te YOK — helper'ın path'i ayırması
       bu yüzden zorunlu (Q11 bunu davranış seviyesinde doğruluyor). */
    expect(hasLocaleRoute("/arama?flexible=3")).toBe(false);
  });
});

/* ===============================================================
   🛡️ SEO LANDING — Villa Tipleri / Bölgeler dil değiştirici
   ===============================================================
   `/en/villa-turleri/[slug]` ve `/en/bolgeler/[slug]` route
   dosyaları var ama allowlist'te değildi → dil değiştirici ana
   sayfaya düşüyordu. Slug locale'den bağımsız (hreflang ile aynı).
   =============================================================== */
describe("SEO landing sayfaları — aynı slug, yalnız locale prefix'i değişir", () => {
  it.each([
    ["/villa-turleri/balayi-villalari", "/villa-turleri/balayi-villalari"],
    ["/en/villa-turleri/balayi-villalari", "/villa-turleri/balayi-villalari"],
    ["/bolgeler/kalkan", "/bolgeler/kalkan"],
    ["/en/bolgeler/kalkan", "/bolgeler/kalkan"],
  ])("%s", (path, tr) => {
    expect(getLocaleSwitchTargets(path)).toEqual({ tr, en: `/en${tr}` });
  });

  it("sayfalama/sort query'si korunur", () => {
    expect(getLocaleSwitchTargets("/en/bolgeler/kalkan", "page=2")).toEqual({
      tr: "/bolgeler/kalkan?page=2",
      en: "/en/bolgeler/kalkan?page=2",
    });
  });

  it("slug'sız bare prefix eşleşmez (route yok → mevcut fallback)", () => {
    expect(hasLocaleRoute("/villa-turleri")).toBe(false);
    expect(hasLocaleRoute("/villa-turleri/")).toBe(false);
    expect(hasLocaleRoute("/bolgeler")).toBe(false);
    expect(getLocaleSwitchTargets("/en/bolgeler")).toEqual({ tr: "/", en: "/en" });
  });

  it("MOD B (varsayılan EN): TR hedefi landing sayfasının kendisidir, /tr değil", () => {
    expect(getLocaleSwitchTargets("/en/villa-turleri/x", "", "/tr").tr).toBe("/villa-turleri/x");
  });
});

/* Gerçek `/en` route dosyalarının HEPSİ allowlist'te olmalı —
   yeni bir locale route eklenip listeye yazılmazsa bu test yakalar. */
describe("allowlist ↔ app/(public)/en route dosyaları", () => {
  it("her EN sayfası için hasLocaleRoute(true)", async () => {
    const { readdirSync } = await import("node:fs");
    const { join, relative, sep } = await import("node:path");
    for (const locale of ["en"]) {
      const root = join(process.cwd(), "app/(public)", locale);
      const paths: string[] = [];
      const walk = (dir: string) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, e.name);
          if (e.isDirectory()) walk(full);
          else if (e.name === "page.tsx") {
            const rel = relative(root, dir).split(sep).filter(Boolean);
            paths.push("/" + rel.map((s) => (s.startsWith("[") ? "ornek" : s)).join("/"));
          }
        }
      };
      walk(root);
      expect(paths.length).toBeGreaterThan(10);
      for (const p of paths) {
        expect({ locale, p, ok: hasLocaleRoute(p) }).toEqual({ locale, p, ok: true });
      }
    }
  });
});
