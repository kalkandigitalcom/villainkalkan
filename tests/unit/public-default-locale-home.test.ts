/* ===============================================================
   🛡️ PUBLIC VARSAYILAN DİL — ANA SAYFA GİRİŞ DAVRANIŞI (URL YAPISI)
   ===============================================================
   İngilizce varsayılan dildir: `/` İngilizce ana sayfayı RENDER eder,
   Türkçe ana sayfa `/tr`'dedir. Hiçbir ayar kombinasyonunda yönlendirme
   veya 404 OLMAZ (`multilingual_enabled` / `public_default_locale`
   public URL yapısını değiştiremez). Eski `/en` adresleri middleware'de
   308 ile `/`'ye taşınır (bkz. legacy-en-redirect testleri).
=============================================================== */
import { describe, it, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});
const getCachedSettingsMock = vi.fn();

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  redirect: (to: string) => redirectMock(to),
  notFound: () => notFoundMock(),
}));

vi.mock("@/lib/cache.helpers", () => ({
  getCachedSettings: () => getCachedSettingsMock(),
}));

/* Ana sayfa gövdesi/metadata'sı bu testin konusu DEĞİL — render
   edilmemeleri için devre dışı bırakılır (yalnız yönlendirme kararı
   test edilir; aynı desen: public-locale-gate.test.ts). */
vi.mock("@/app/components/home/HomePageBody", () => ({
  default: () => null,
}));
vi.mock("@/app/components/home/home-metadata", () => ({
  buildHomeMetadata: async () => ({}),
}));

beforeEach(() => {
  redirectMock.mockClear();
  notFoundMock.mockClear();
  getCachedSettingsMock.mockReset();
});

const ML_OFF_EN = { multilingual_enabled: false, public_default_locale: "en" };
const ML_ON_TR = { multilingual_enabled: true, public_default_locale: "tr" };
const ML_ON_DE = { multilingual_enabled: true, public_default_locale: "de" };
const ML_ON_EN = { multilingual_enabled: true, public_default_locale: "en" };
const ML_ON_INVALID = { multilingual_enabled: true, public_default_locale: "fr" };

const ALL_SETTINGS = [
  ["multilingual kapalı + en", ML_OFF_EN],
  ["multilingual açık + tr", ML_ON_TR],
  ["multilingual açık + de (desteklenmiyor)", ML_ON_DE],
  ["multilingual açık + en", ML_ON_EN],
  ["geçersiz locale", ML_ON_INVALID],
] as const;

async function renderRoot() {
  const mod = await import("@/app/(public)/page");
  return mod.default();
}

async function renderTr() {
  const mod = await import("@/app/(public)/tr/page");
  return mod.default();
}

describe("resolvePublicHome (saf kural — URL yapısı)", () => {
  it.each(ALL_SETTINGS)("%s → varsayılan 'en', kökte yönlendirme YOK, TR ana sayfa /tr", async (_l, settings) => {
    const { resolvePublicHome } = await import("@/lib/i18n/public-home");
    expect(resolvePublicHome(settings)).toEqual({
      defaultLocale: "en",
      redirectsFromRoot: false,
      trHomeHref: "/tr",
    });
  });

  it("settings null/undefined → aynı sonuç", async () => {
    const { resolvePublicHome } = await import("@/lib/i18n/public-home");
    expect(resolvePublicHome(null).trHomeHref).toBe("/tr");
    expect(resolvePublicHome(undefined).redirectsFromRoot).toBe(false);
  });

  it("DEFAULT_LOCALE (içerik/çeviri canonical dili) hâlâ 'tr'", async () => {
    const { DEFAULT_LOCALE, ROUTE_DEFAULT_LOCALE } = await import("@/lib/i18n/config");
    expect(DEFAULT_LOCALE).toBe("tr");
    expect(ROUTE_DEFAULT_LOCALE).toBe("en");
  });
});

describe('"/" (İngilizce ana sayfa)', () => {
  it.each(ALL_SETTINGS)("%s → render edilir, redirect/404 YOK", async (_l, settings) => {
    getCachedSettingsMock.mockResolvedValue(settings);
    await renderRoot();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("settings okunamıyor → yine render edilir, sayfa ÇÖKMEZ", async () => {
    getCachedSettingsMock.mockRejectedValue(new Error("db down"));
    await renderRoot();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});

describe('"/tr" (Türkçe ana sayfa)', () => {
  it.each(ALL_SETTINGS)("%s → render edilir, yönlenmez", async (_l, settings) => {
    getCachedSettingsMock.mockResolvedValue(settings);
    await renderTr();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
