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

  it("2) '/tr/arama' → true", () => {
    expect(hasLocaleRoute("/arama")).toBe(true);
  });

  it("3) '/tr/kiralik-villalar' → true", () => {
    expect(hasLocaleRoute("/kiralik-villalar")).toBe(true);
  });

  it("4) '/tr/kiralik-villa/test-villa' (slug'lı) → true", () => {
    expect(hasLocaleRoute("/kiralik-villa/test-villa")).toBe(true);
  });

  it("5) '/tr/rezervasyon/test-villa' (slug'lı) → true", () => {
    expect(hasLocaleRoute("/rezervasyon/test-villa")).toBe(true);
  });

  it("6) '/tr/kiralik-villa/' (slug'sız, bare prefix) → false", () => {
    expect(hasLocaleRoute("/kiralik-villa/")).toBe(false);
  });

  it("7) '/tr/kiralik-villa' (trailing slash yok, slug yok) → false", () => {
    expect(hasLocaleRoute("/kiralik-villa")).toBe(false);
  });

  /* 🛡️ PUBLIC ÇOKLU DİL TAMAMLAMA — `/teklif-al` GERÇEK route
     dosyaları eklendi (ortak `OfferPageBody`) → allowlist'e girdi. */
  it("8) '/tr/teklif-al' → true (EN route'ları var)", () => {
    expect(hasLocaleRoute("/teklif-al")).toBe(true);
  });

  /* 🛡️ PUBLIC ÇOKLU DİL TAMAMLAMA — `/blog` ve
     `/blog/[slug]` GERÇEK route dosyaları eklendi (ortak
     `BlogIndexPageBody` / `BlogDetailPageBody` + migration 089
     `blog_post_translations`) → beklenen değer false → true. */
  it("9) '/tr/blog' → true (EN route'ları var)", () => {
    expect(hasLocaleRoute("/blog")).toBe(true);
  });

  it("9b) '/tr/blog/bir-yazi' → true (detay route'ları var)", () => {
    expect(hasLocaleRoute("/blog/bir-yazi")).toBe(true);
  });

  it("9c) '/bloglar' → false (prefix ile YANLIŞLIKLA eşleşmez)", () => {
    expect(hasLocaleRoute("/bloglar")).toBe(false);
  });

  /* 🛡️ PUBLIC ÇOKLU DİL TAMAMLAMA — `/favoriler`. */
  it("10) '/tr/favoriler' → true (EN route'ları var)", () => {
    expect(hasLocaleRoute("/favoriler")).toBe(true);
  });

  it("10b) '/tr/favoriler/paylas/<token>' → true (prefixed allowlist)", () => {
    expect(hasLocaleRoute("/favoriler/paylas/abc123")).toBe(true);
  });

  it("10c) '/tr/kisa-sureli-tarihler/haziran/2' → true (prefixed allowlist)", () => {
    expect(hasLocaleRoute("/kisa-sureli-tarihler/haziran/2")).toBe(true);
  });

  /* 🛡️ `/iletisim` GERÇEK route dosyaları eklendi (ortak
     `ContactPageBody`) → allowlist'e girdi; artık fallback DEĞİL. */
  it("11) '/tr/iletisim' → true (EN route'ları var)", () => {
    expect(hasLocaleRoute("/iletisim")).toBe(true);
  });

  it("12) '/tr/liste' → false", () => {
    expect(hasLocaleRoute("/liste")).toBe(false);
  });

  /* 🛡️ PUBLIC ÇOKLU DİL TAMAMLAMA — `/rezervasyon-kontrol`.
     ⚠️ Eşleşme `/tr/rezervasyon/` PREFIX'inden değil, KENDİ exact
     kaydından gelir (aşağıdaki 13b bunu doğrular). */
  it("13) '/tr/rezervasyon-kontrol' → true (EN route'ları var)", () => {
    expect(hasLocaleRoute("/rezervasyon-kontrol")).toBe(true);
  });

  it("13b) '/rezervasyon-kontrolX' → false (prefix ile YANLIŞLIKLA eşleşmez)", () => {
    expect(hasLocaleRoute("/rezervasyon-kontrolX")).toBe(false);
  });

  /* 🛡️ PUBLIC ÇOKLU DİL TAMAMLAMA — `/v/[token]` ve
     `/liste/[token]` GERÇEK route dosyaları eklendi. Sayfalar
     `noindex`'tir ama kullanıcı linke EN ile de ulaşabildiği için
     dil değiştirici çalışmalıdır → beklenen değer false → true. */
  it("14) '/tr/v/abc123' → true (EN route'ları var)", () => {
    expect(hasLocaleRoute("/v/abc123")).toBe(true);
  });

  it("14b) '/tr/liste/abc123' → true (EN route'ları var)", () => {
    expect(hasLocaleRoute("/liste/abc123")).toBe(true);
  });

  it("14c) '/tr/v/' → false (token YOKSA eşleşmez)", () => {
    expect(hasLocaleRoute("/v/")).toBe(false);
  });

  /* 🛡️ PHASE 12D — /en/p/[slug] route'u EKLENDİ;
     bu yüzden beklenen değer false → true olarak GÜNCELLENDİ. */
  it("15) '/tr/p/some-slug' (slug'lı) → true", () => {
    expect(hasLocaleRoute("/p/some-slug")).toBe(true);
  });

  it("15b) '/tr/p/' (slug'sız, bare prefix) → false", () => {
    expect(hasLocaleRoute("/p/")).toBe(false);
  });

  it("15c) '/tr/p' → false", () => {
    expect(hasLocaleRoute("/p")).toBe(false);
  });

  it("16) '/tr/kisa-sureli-tarihler' → false", () => {
    expect(hasLocaleRoute("/kisa-sureli-tarihler")).toBe(false);
  });
});

describe("getLocaleSwitchTargets", () => {
  it("1) '/' → tr:'/tr', en:'/'", () => {
    expect(getLocaleSwitchTargets("/")).toEqual({
      tr: "/tr",
      en: "/",
    });
  });

  it("2) null pathname → '/' ile aynı davranır", () => {
    expect(getLocaleSwitchTargets(null)).toEqual({
      tr: "/tr",
      en: "/",
    });
  });

  it("3) undefined pathname → '/' ile aynı davranır", () => {
    expect(getLocaleSwitchTargets(undefined)).toEqual({
      tr: "/tr",
      en: "/",
    });
  });

  it("4) '/' (EN ana sayfa) → tr:'/tr', en:'/'", () => {
    expect(getLocaleSwitchTargets("/")).toEqual({
      tr: "/tr",
      en: "/",
    });
  });

  it("5) DE desteği kaldırıldı — '/de/kiralik-villalar' locale route DEĞİL, fallback'e düşer ve 'de' hedefi ÜRETİLMEZ", () => {
    const t = getLocaleSwitchTargets("/de/kiralik-villalar");
    expect(t).toEqual({ tr: "/tr", en: "/" });
    expect("de" in t).toBe(false);
  });

  it("6) '/tr/kiralik-villalar' → 2 locale varyantı (gerçek route)", () => {
    expect(getLocaleSwitchTargets("/tr/kiralik-villalar")).toEqual({
      tr: "/tr/kiralik-villalar",
      en: "/kiralik-villalar",
    });
  });

  it("7) '/tr/kiralik-villa/test-villa' → 2 locale varyantı", () => {
    expect(getLocaleSwitchTargets("/tr/kiralik-villa/test-villa")).toEqual({
      tr: "/tr/kiralik-villa/test-villa",
      en: "/kiralik-villa/test-villa",
    });
  });

  it("8) '/kiralik-villa/test-villa' (zaten EN prefixli) → aynı 2 varyant", () => {
    expect(getLocaleSwitchTargets("/kiralik-villa/test-villa")).toEqual({
      tr: "/tr/kiralik-villa/test-villa",
      en: "/kiralik-villa/test-villa",
    });
  });

  it("10) '/tr/rezervasyon/test-villa' → 2 locale varyantı", () => {
    expect(getLocaleSwitchTargets("/tr/rezervasyon/test-villa")).toEqual({
      tr: "/tr/rezervasyon/test-villa",
      en: "/rezervasyon/test-villa",
    });
  });

  it("11) '/tr/teklif-al' → locale prefix'li hedefler", () => {
    expect(getLocaleSwitchTargets("/tr/teklif-al")).toEqual({
      tr: "/tr/teklif-al",
      en: "/teklif-al",
    });
  });

  it("12) '/teklif-al' → EN '/teklif-al', TR '/tr/teklif-al'", () => {
    const targets = getLocaleSwitchTargets("/teklif-al");
    expect(targets.tr).toBe("/tr/teklif-al");
    expect(targets.en).toBe("/teklif-al");
  });

  it("13) '/blog' → locale prefix'li hedefler (artık EN route'u var)", () => {
    expect(getLocaleSwitchTargets("/blog")).toEqual({
      tr: "/tr/blog",
      en: "/blog",
    });
  });

  it("13c) '/blog/bir-yazi' → slug AYNEN korunur", () => {
    expect(getLocaleSwitchTargets("/blog/bir-yazi")).toEqual({
      tr: "/tr/blog/bir-yazi",
      en: "/blog/bir-yazi",
    });
  });

  it("14) '/tr/rezervasyon-kontrol' → locale prefix'li hedefler", () => {
    expect(getLocaleSwitchTargets("/tr/rezervasyon-kontrol")).toEqual({
      tr: "/tr/rezervasyon-kontrol",
      en: "/rezervasyon-kontrol",
    });
  });

  it("15) '/tr/favoriler' → locale prefix'li hedefler", () => {
    expect(getLocaleSwitchTargets("/tr/favoriler")).toEqual({
      tr: "/tr/favoriler",
      en: "/favoriler",
    });
  });

  /* 🛡️ Dinamik segmentler (token / ay / gece) AYNEN korunur. */
  it("15b) '/favoriler/paylas/abc123' → token korunur", () => {
    expect(getLocaleSwitchTargets("/favoriler/paylas/abc123")).toEqual({
      tr: "/tr/favoriler/paylas/abc123",
      en: "/favoriler/paylas/abc123",
    });
  });

  it("15c) '/kisa-sureli-tarihler/haziran/2' → ay/gece korunur", () => {
    expect(
      getLocaleSwitchTargets("/kisa-sureli-tarihler/haziran/2")
    ).toEqual({
      tr: "/tr/kisa-sureli-tarihler/haziran/2",
      en: "/kisa-sureli-tarihler/haziran/2",
    });
  });

  it("16) '/tr/v/abc123' → token AYNEN korunur", () => {
    expect(getLocaleSwitchTargets("/tr/v/abc123")).toEqual({
      tr: "/tr/v/abc123",
      en: "/v/abc123",
    });
  });

  it("16b) '/liste/abc123' → token AYNEN korunur", () => {
    expect(getLocaleSwitchTargets("/liste/abc123")).toEqual({
      tr: "/tr/liste/abc123",
      en: "/liste/abc123",
    });
  });
});

/* ═══════════════════════════════════════════════════════════════
   🛡️ QUERY STRING KORUMA — `/tr/arama` dil değiştirme düzeltmesi
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

  it("Q1) '/tr/arama' + query → '/arama' + AYNI query", () => {
    expect(getLocaleSwitchTargets("/tr/arama", Q)).toEqual({
      tr: `/tr/arama?${Q}`,
      en: `/arama?${Q}`,
    });
  });

  it("Q2) '/arama' + query → '/tr/arama' + AYNI query", () => {
    expect(getLocaleSwitchTargets("/arama", Q)).toEqual({
      tr: `/tr/arama?${Q}`,
      en: `/arama?${Q}`,
    });
  });

  it("Q4) birden fazla parametre — adları/değerleri/SIRASI korunur", () => {
    const multi = "regions=fethiye&guests=6&start=2026-07-01&end=2026-07-08&page=2&sort=price-asc";
    const t = getLocaleSwitchTargets("/tr/arama", multi);
    expect(t.en).toBe(`/arama?${multi}`);
    expect(t.tr).toBe(`/tr/arama?${multi}`);
  });

  it("Q5) `villa-turleri` virgüllü değerleri canonical slug olarak kalır (çeviri YOK)", () => {
    const q = "villa-turleri=2027-kiralik-villalar%2Cmuhafazakar-villalar";
    const t = getLocaleSwitchTargets("/arama", q);
    expect(t.en).toBe(`/arama?${q}`);
    expect(t.en).toContain("2027-kiralik-villalar%2Cmuhafazakar-villalar");
    /* Slug'lar hiçbir locale'de değişmez — 2 hedefte de AYNI token. */
    expect(t.tr.endsWith(q)).toBe(true);
  });

  it("Q6) `flexible` parametresi korunur", () => {
    expect(getLocaleSwitchTargets("/tr/arama", "flexible=3")).toEqual({
      tr: "/tr/arama?flexible=3",
      en: "/arama?flexible=3",
    });
  });

  it("Q7) query YOK (undefined / '' / '?') → MEVCUT davranış birebir (soru işareti eklenmez)", () => {
    const expected = { tr: "/tr/arama", en: "/arama" };
    expect(getLocaleSwitchTargets("/tr/arama")).toEqual(expected);
    expect(getLocaleSwitchTargets("/tr/arama", "")).toEqual(expected);
    expect(getLocaleSwitchTargets("/tr/arama", "?")).toEqual(expected);
    expect(getLocaleSwitchTargets("/tr/arama", null)).toEqual(expected);
  });

  it("Q8) URL encoding BOZULMAZ — percent-encoded değerler decode/re-encode edilmez", () => {
    const q = "regions=k%C3%B6ycegiz%2Csarigerme&q=deniz%20manzara";
    const t = getLocaleSwitchTargets("/tr/arama", q);
    expect(t.en).toBe(`/arama?${q}`);
    expect(t.en).toContain("k%C3%B6ycegiz%2Csarigerme");
    expect(t.en).toContain("deniz%20manzara");
    expect(t.en).not.toContain("köycegiz");
  });

  it("Q9) DİĞER locale route'ları etkilenmez", () => {
    /* (a) allowlist'teki route → query AYNEN korunur */
    expect(getLocaleSwitchTargets("/tr/teklif-al", "foo=bar")).toEqual({
      tr: "/tr/teklif-al?foo=bar",
      en: "/teklif-al?foo=bar",
    });
    /* (a2) `/tr/blog` artık allowlist'te → query AYNEN korunur */
    expect(getLocaleSwitchTargets("/blog", "x=1")).toEqual({
      tr: "/tr/blog?x=1",
      en: "/blog?x=1",
    });
    /* (a3) gerçek fallback (locale karşılığı YOK) → query EKLENMEZ */
    expect(getLocaleSwitchTargets("/bilinmeyen-sayfa", "x=1")).toEqual({
      tr: "/tr",
      en: "/",
    });

    /* (b) query'siz çağrılar — Phase 10C çıktısı BİREBİR aynı */
    expect(getLocaleSwitchTargets("/")).toEqual({ tr: "/tr", en: "/" });
    expect(getLocaleSwitchTargets("/tr/kiralik-villa/test-villa")).toEqual({
      tr: "/tr/kiralik-villa/test-villa",
      en: "/kiralik-villa/test-villa",
    });

    /* (c) query'li diğer allowlist route'ları da aynı kuralı izler */
    expect(getLocaleSwitchTargets("/tr/kiralik-villa/test-villa", "guests=4").en).toBe(
      "/kiralik-villa/test-villa?guests=4"
    );
    expect(getLocaleSwitchTargets("/tr/p/hakkimizda", "utm=x").en).toBe(
      "/p/hakkimizda?utm=x"
    );
  });

  it("Q10) '?' önekli ve öneksiz search AYNI sonucu verir", () => {
    expect(getLocaleSwitchTargets("/tr/arama", `?${Q}`)).toEqual(
      getLocaleSwitchTargets("/tr/arama", Q)
    );
  });

  it("Q11) pathname içine gömülü query — allowlist eşleşmesi BOZULMAZ (savunmacı)", () => {
    expect(getLocaleSwitchTargets("/tr/arama?flexible=3")).toEqual({
      tr: "/tr/arama?flexible=3",
      en: "/arama?flexible=3",
    });
    expect(getLocaleSwitchTargets("/arama?flexible=3").tr).toBe("/tr/arama?flexible=3");
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
   `/villa-turleri/[slug]` ve `/bolgeler/[slug]` route
   dosyaları var ama allowlist'te değildi → dil değiştirici ana
   sayfaya düşüyordu. Slug locale'den bağımsız (hreflang ile aynı).
   =============================================================== */
describe("SEO landing sayfaları — aynı slug, yalnız locale prefix'i değişir", () => {
  it.each([
    ["/tr/villa-turleri/balayi-villalari", "/tr/villa-turleri/balayi-villalari"],
    ["/villa-turleri/balayi-villalari", "/tr/villa-turleri/balayi-villalari"],
    ["/tr/bolgeler/kalkan", "/tr/bolgeler/kalkan"],
    ["/bolgeler/kalkan", "/tr/bolgeler/kalkan"],
  ])("%s", (path, tr) => {
    expect(getLocaleSwitchTargets(path)).toEqual({ tr, en: tr.replace(/^\/tr/, "") });
  });

  it("sayfalama/sort query'si korunur", () => {
    expect(getLocaleSwitchTargets("/bolgeler/kalkan", "page=2")).toEqual({
      tr: "/tr/bolgeler/kalkan?page=2",
      en: "/bolgeler/kalkan?page=2",
    });
  });

  it("slug'sız bare prefix eşleşmez (route yok → mevcut fallback)", () => {
    expect(hasLocaleRoute("/villa-turleri")).toBe(false);
    expect(hasLocaleRoute("/villa-turleri/")).toBe(false);
    expect(hasLocaleRoute("/bolgeler")).toBe(false);
    expect(getLocaleSwitchTargets("/bolgeler")).toEqual({ tr: "/tr", en: "/" });
  });

  it("MOD B (varsayılan EN): TR hedefi landing sayfasının kendisidir, /tr değil", () => {
    expect(getLocaleSwitchTargets("/villa-turleri/x", "", "/tr").tr).toBe("/tr/villa-turleri/x");
  });
});

/* Gerçek `/` route dosyalarının HEPSİ allowlist'te olmalı —
   yeni bir locale route eklenip listeye yazılmazsa bu test yakalar. */
describe("allowlist ↔ app/(public) (İngilizce, prefix'siz) route dosyaları", () => {
  it("her EN sayfası için hasLocaleRoute(true)", async () => {
    const { readdirSync } = await import("node:fs");
    const { join, relative, sep } = await import("node:path");
    for (const locale of ["en"]) {
      const root = join(process.cwd(), "app/(public)");
      const paths: string[] = [];
      const walk = (dir: string) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, e.name);
          /* `/tr` altı Türkçe kopyalardır; taban path'leri kökteki EN sayfalarıdır. */
          if (e.isDirectory()) {
            if (dir === root && e.name === "tr") continue;
            walk(full);
          }
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
