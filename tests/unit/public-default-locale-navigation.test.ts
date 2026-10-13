/* ===============================================================
   🛡️ VARSAYILAN DİL — TR HEDEFLERİ (DÖNGÜ KORUMASI) + SEO
   ===============================================================
   EN KRİTİK KURAL: varsayılan dil EN iken `/` bir YÖNLENDİRİCİDİR.
   Eğer dil değiştiricinin "TR" hedefi veya logo/ana-sayfa linkleri
   `/` kalsaydı, TÜRKÇE seçen kullanıcı ANINDA varsayılan dile geri
   düşerdi. Bu dosya TR hedeflerinin `/tr`'ye gittiğini ve
   hreflang/sitemap'in hiçbir redirect URL'ine işaret etmediğini
   kilitler.

   Varsayılan "tr" / multilingual kapalı iken TÜM çıktılar bugünkü
   davranışla BYTE-IDENTICAL olmalıdır — her testin A-modu eşi var.
=============================================================== */
import { describe, it, expect } from "vitest";

import { getLocaleSwitchTargets } from "@/lib/i18n/locale-switch.helper";
import { resolvePublicHome } from "@/lib/i18n/public-home";
import { buildLocaleAlternates } from "@/lib/i18n/seo-alternates";
import { DEFAULT_LOCALE, localeFromPathname } from "@/lib/i18n/config";
import { localeHref } from "@/lib/i18n/locale-href";

const ML_ON_EN = { multilingual_enabled: true, public_default_locale: "en" };
/* DE desteği kaldırıldı — "de" artık geçerli bir varsayılan dil DEĞİL. */
const ML_ON_DE_LEGACY = { multilingual_enabled: true, public_default_locale: "de" };
const ML_ON_TR = { multilingual_enabled: true, public_default_locale: "tr" };
const ML_OFF = { multilingual_enabled: false, public_default_locale: "en" };

const TR_HOME_B = resolvePublicHome(ML_ON_EN).trHomeHref; // "/tr"
const TR_HOME_A = resolvePublicHome(ML_ON_TR).trHomeHref; // "/"

/* Header / Footer / BottomNav'ın ana sayfa linki için kullandığı
   TÜRETME — üç component'te de BİREBİR aynı ifade. */
function homeHrefFor(locale: "tr" | "en", trHomeHref: string) {
  return locale === DEFAULT_LOCALE ? trHomeHref : localeHref("/", locale);
}

describe("10) Dil değiştirici — TÜRKÇE seçimi varsayılan dile GERİ DÜŞÜRMEZ", () => {
  it("MOD B: /en ana sayfasında TR hedefi '/tr' (yönlendirilen '/' DEĞİL)", () => {
    const t = getLocaleSwitchTargets("/en", "", TR_HOME_B);
    expect(t.tr).toBe("/tr");
    expect(t.en).toBe("/en");
    expect("de" in t).toBe(false);
  });

  it("MOD B: /tr üzerindeyken hedefler doğru (TR kendisi, EN kökü)", () => {
    const t = getLocaleSwitchTargets("/tr", "", TR_HOME_B);
    expect(t.tr).toBe("/tr");
    expect(t.en).toBe("/en");
  });

  it("MOD A: TR hedefi '/' — BYTE-IDENTICAL (bugünkü davranış)", () => {
    expect(getLocaleSwitchTargets("/en", "", TR_HOME_A)).toEqual(
      getLocaleSwitchTargets("/en", "")
    );
    expect(getLocaleSwitchTargets("/en", "", TR_HOME_A).tr).toBe("/");
  });

  it("trHomePath hiç verilmezse eski davranış AYNEN korunur", () => {
    expect(getLocaleSwitchTargets("/en").tr).toBe("/");
    expect(getLocaleSwitchTargets("/en/iletisim").tr).toBe("/iletisim");
  });
});

describe("9) İç TR route'ları ETKİLENMEZ (prefix'siz mimari korunur)", () => {
  it("MOD B'de bile /kiralik-villalar, /arama, /iletisim TR hedefleri prefix'siz", () => {
    expect(getLocaleSwitchTargets("/en/kiralik-villalar", "", TR_HOME_B).tr).toBe(
      "/kiralik-villalar"
    );
    expect(getLocaleSwitchTargets("/en/arama", "", TR_HOME_B).tr).toBe("/arama");
    expect(getLocaleSwitchTargets("/en/iletisim", "", TR_HOME_B).tr).toBe(
      "/iletisim"
    );
  });

  it("query string MOD B'de de AYNEN taşınır", () => {
    expect(
      getLocaleSwitchTargets("/en/arama", "villa-turleri=x&flexible=3", TR_HOME_B).tr
    ).toBe("/arama?villa-turleri=x&flexible=3");
  });

  it("localeHref DEĞİŞMEDİ — iç TR path'leri prefix ALMAZ", () => {
    expect(localeHref("/kiralik-villalar", "tr")).toBe("/kiralik-villalar");
    expect(localeHref("/arama?a=1", "tr")).toBe("/arama?a=1");
    expect(localeHref("/kiralik-villalar", "en")).toBe("/en/kiralik-villalar");
  });
});

describe("Logo / ana sayfa linki (Header · Footer · BottomNav)", () => {
  it("MOD B + TR locale → '/tr' (yönlendirilen '/' DEĞİL)", () => {
    expect(homeHrefFor("tr", TR_HOME_B)).toBe("/tr");
  });

  it("MOD B + EN locale → mevcut localeHref davranışı AYNEN", () => {
    expect(homeHrefFor("en", TR_HOME_B)).toBe("/en");
  });

  it("MOD A → her locale için BYTE-IDENTICAL eski çıktı", () => {
    expect(homeHrefFor("tr", TR_HOME_A)).toBe(localeHref("/", "tr"));
    expect(homeHrefFor("en", TR_HOME_A)).toBe(localeHref("/", "en"));
  });

  it("multilingual kapalı → '/' (bugünkü production)", () => {
    expect(homeHrefFor("tr", resolvePublicHome(ML_OFF).trHomeHref)).toBe("/");
  });
});

describe("/tr locale tespiti — Header/Footer/TopBar TR render eder", () => {
  it("localeFromPathname('/tr') === 'tr'", () => {
    expect(localeFromPathname("/tr")).toBe("tr");
  });

  it("/tr, /en olarak YANLIŞ tespit EDİLMEZ", () => {
    expect(localeFromPathname("/tr")).not.toBe("en");
  });

  it("DE desteği kaldırıldı — '/de' artık TR'ye düşer", () => {
    expect(localeFromPathname("/de")).toBe("tr");
  });
});

describe("12) SEO — hiçbir hreflang hedefi redirect'e düşmez", () => {
  /* home-metadata.ts'teki ana-sayfaya-özel düzeltmenin AYNI ifadesi. */
  function homeAlternates(settings: unknown, locale: "tr" | "en") {
    const { canonical, languages } = buildLocaleAlternates("/", locale);
    const home = resolvePublicHome(settings as never);
    if (!home.redirectsFromRoot) return { canonical, languages };
    const l = {
      ...languages,
      tr: home.trHomeHref,
      "x-default": languages[home.defaultLocale],
    };
    return { canonical: l[locale], languages: l };
  }

  it("MOD B: tr → /tr, x-default → /en, canonical'lar doğru", () => {
    const en = homeAlternates(ML_ON_EN, "en");
    expect(en.languages.tr).toBe("/tr");
    expect(en.languages["x-default"]).toBe("/en");
    expect(en.canonical).toBe("/en");

    const tr = homeAlternates(ML_ON_EN, "tr");
    expect(tr.canonical).toBe("/tr");
  });

  it("MOD B: hiçbir hreflang değeri '/' (yönlendirici) DEĞİL", () => {
    const { languages } = homeAlternates(ML_ON_EN, "en");
    expect(Object.values(languages)).not.toContain("/");
  });

  it("MOD A: çıktı buildLocaleAlternates ile BYTE-IDENTICAL", () => {
    for (const loc of ["tr", "en"] as const) {
      expect(homeAlternates(ML_ON_TR, loc)).toEqual(
        buildLocaleAlternates("/", loc)
      );
      expect(homeAlternates(ML_OFF, loc)).toEqual(
        buildLocaleAlternates("/", loc)
      );
    }
  });

  it("MOD A: tr ve x-default hâlâ '/' (bugünkü SEO davranışı)", () => {
    const { languages } = homeAlternates(ML_ON_TR, "tr");
    expect(languages.tr).toBe("/");
    expect(languages["x-default"]).toBe("/");
  });
});

describe("Sitemap ana sayfa girdisi", () => {
  it("MOD B → indexlenebilir TR ana sayfa '/tr'", () => {
    expect(resolvePublicHome(ML_ON_EN).trHomeHref).toBe("/tr");
  });

  it("MOD A → '/' (priority 1.0 girdisi DEĞİŞMEZ)", () => {
    expect(resolvePublicHome(ML_ON_TR).trHomeHref).toBe("/");
    expect(resolvePublicHome(ML_OFF).trHomeHref).toBe("/");
  });

  it("DE desteği kaldırıldı — public_default_locale 'de' MOD B'yi TETİKLEMEZ", () => {
    expect(resolvePublicHome(ML_ON_DE_LEGACY).trHomeHref).toBe("/");
  });
});
