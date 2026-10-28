/* ===============================================================
   🛡️ VARSAYILAN DİL — URL YAPISI: TR HEDEFLERİ + SEO
   ===============================================================
   İngilizce varsayılan dil kökte (`/`), Türkçe `/tr` altında yaşar.
   Bu dosya şunları kilitler:
     • dil değiştiricinin TR hedefi `/tr...`, EN hedefi prefix'siz;
     • logo/ana sayfa linkleri: TR → `/tr`, EN → `/`;
     • hreflang/sitemap'te hiçbir değer eski `/en` adresine işaret etmez;
     • `multilingual_enabled` / `public_default_locale` ayarları bu
       yapıyı DEĞİŞTİRMEZ.
=============================================================== */
import { describe, it, expect } from "vitest";

import { getLocaleSwitchTargets } from "@/lib/i18n/locale-switch.helper";
import { resolvePublicHome } from "@/lib/i18n/public-home";
import { buildLocaleAlternates } from "@/lib/i18n/seo-alternates";
import { localeFromPathname } from "@/lib/i18n/config";
import { localeHref, localePathPrefix } from "@/lib/i18n/locale-href";

const SETTINGS = [
  { multilingual_enabled: true, public_default_locale: "en" },
  { multilingual_enabled: true, public_default_locale: "tr" },
  { multilingual_enabled: true, public_default_locale: "de" },
  { multilingual_enabled: false, public_default_locale: "en" },
  null,
];

describe("10) Dil değiştirici — TR/EN hedefleri", () => {
  it("'/' (EN ana sayfa) → TR '/tr', EN '/'", () => {
    expect(getLocaleSwitchTargets("/")).toEqual({ tr: "/tr", en: "/" });
  });

  it("'/tr' (TR ana sayfa) → TR '/tr', EN '/'", () => {
    expect(getLocaleSwitchTargets("/tr")).toEqual({ tr: "/tr", en: "/" });
  });

  it("trHomePath ('/' dahil) verilse bile TR ana sayfa hedefi '/tr' kalır", () => {
    expect(getLocaleSwitchTargets("/", "", "/").tr).toBe("/tr");
    expect(getLocaleSwitchTargets("/", "", "/tr").tr).toBe("/tr");
  });
});

describe("9) İç sayfalar — aynı sayfanın diğer dildeki karşılığı", () => {
  it("TR iç sayfadan EN karşılığına, EN iç sayfadan TR karşılığına", () => {
    for (const p of ["/kiralik-villalar", "/arama", "/iletisim"]) {
      expect(getLocaleSwitchTargets(`/tr${p}`)).toEqual({ tr: `/tr${p}`, en: p });
      expect(getLocaleSwitchTargets(p)).toEqual({ tr: `/tr${p}`, en: p });
    }
  });

  it("query string AYNEN taşınır", () => {
    expect(getLocaleSwitchTargets("/tr/arama", "flexible=3")).toEqual({
      tr: "/tr/arama?flexible=3",
      en: "/arama?flexible=3",
    });
  });

  it("localeHref: TR '/tr' prefix'i alır, EN prefix'siz kalır", () => {
    expect(localeHref("/kiralik-villalar", "tr")).toBe("/tr/kiralik-villalar");
    expect(localeHref("/kiralik-villalar", "en")).toBe("/kiralik-villalar");
    expect(localeHref("/arama?x=1", "tr")).toBe("/tr/arama?x=1");
  });
});

describe("Logo / ana sayfa linki (Header · Footer · BottomNav)", () => {
  it("TR → '/tr', EN → '/'", () => {
    expect(localeHref("/", "tr")).toBe("/tr");
    expect(localeHref("/", "en")).toBe("/");
  });

  it("localePathPrefix: TR '/tr', EN ''", () => {
    expect(localePathPrefix("tr")).toBe("/tr");
    expect(localePathPrefix("en")).toBe("");
  });

  it("hiçbir ayar kombinasyonu TR ana sayfayı '/'ye düşürmez", () => {
    for (const s of SETTINGS) {
      expect(resolvePublicHome(s).trHomeHref).toBe("/tr");
      expect(resolvePublicHome(s).redirectsFromRoot).toBe(false);
    }
  });
});

describe("/tr locale tespiti", () => {
  it("localeFromPathname('/tr') === 'tr', prefix'siz === 'en'", () => {
    expect(localeFromPathname("/tr")).toBe("tr");
    expect(localeFromPathname("/tr/kiralik-villalar")).toBe("tr");
    expect(localeFromPathname("/")).toBe("en");
    expect(localeFromPathname("/kiralik-villalar")).toBe("en");
  });

  it("'/de' locale değil → varsayılan 'en'", () => {
    expect(localeFromPathname("/de")).toBe("en");
  });
});

describe("12) SEO — hreflang hiçbir zaman eski '/en' adresine işaret etmez", () => {
  it("ana sayfa: tr '/tr', en '/', x-default '/'", () => {
    for (const locale of ["tr", "en"] as const) {
      const { canonical, languages } = buildLocaleAlternates("/", locale);
      expect(languages).toEqual({ tr: "/tr", en: "/", "x-default": "/" });
      expect(canonical).toBe(locale === "tr" ? "/tr" : "/");
    }
  });

  it("iç sayfa hreflang değerleri '/en' içermez", () => {
    const { languages } = buildLocaleAlternates("/kiralik-villa/x", "tr");
    for (const v of Object.values(languages)) {
      expect(v === "/en" || v.startsWith("/en/")).toBe(false);
    }
  });
});
