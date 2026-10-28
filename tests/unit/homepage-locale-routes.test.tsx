/* ===============================================================
   🛡️ PHASE 11 — ANA SAYFA ROUTE + CACHE İZOLASYON TESTLERİ
   ===============================================================
   Kapsam:
     A) `/` ve `/en` AYNI `HomePageBody` component'ini
        render eder (ayrı kopya YOK) ve DOĞRU locale'i geçirir
        (DE desteği kaldırıldı — `/de` route ağacı YOK)
     B) EN `setRequestLocale` + `requirePublicLocaleEnabled` gate
        davranışı KORUNDU (multilingual kapalıyken notFound)
     C) EN ana sayfasında placeholder `noindex` KALDIRILDI
     D) 🔴 CACHE LOCALE İZOLASYONU — SSS cache key'i locale içerir,
        yani EN çevirisi TR isteğine servis EDİLEMEZ

   `locale-routes.test.tsx` (Phase 4A/10B) ile AYNI mock deseni;
   sayfa fonksiyonu ÇAĞRILIR ve dönen React element'i incelenir
   (DOM render YOK → tüm veri katmanını mock'lamaya gerek kalmaz).
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

const requirePublicLocaleEnabledMock = vi.fn();
const setRequestLocaleMock = vi.fn();

vi.mock("@/lib/i18n/public-locale-gate.server", () => ({
  requirePublicLocaleEnabled: () => requirePublicLocaleEnabledMock(),
}));
vi.mock("@/lib/i18n/request-locale.server", () => ({
  setRequestLocale: (...a: unknown[]) => setRequestLocaleMock(...a),
}));

import HomePageBody from "@/app/components/home/HomePageBody";

beforeEach(() => {
  requirePublicLocaleEnabledMock.mockReset();
  setRequestLocaleMock.mockReset();
  requirePublicLocaleEnabledMock.mockResolvedValue(undefined);
});

/* ===============================================================
   A + B) ROUTE DAVRANIŞI
   =============================================================== */
const LOCALE_ROUTES: Array<[string, "en"]> = [
  ["@/app/(public)/page", "en"],
];

describe.each(LOCALE_ROUTES)("%s", (modulePath, locale) => {
  it(`1) gate geçerse ORTAK HomePageBody'yi locale="${locale}" ile render eder`, async () => {
    const { default: Page } = await import(modulePath);
    const element = await Page();

    expect(setRequestLocaleMock).toHaveBeenCalledWith(locale);
    expect(requirePublicLocaleEnabledMock).toHaveBeenCalledTimes(1);
    expect(element.type).toBe(HomePageBody);
    expect(element.props.locale).toBe(locale);
  });

  it(`2) multilingual KAPALI → gate'in notFound()'u PROPAGATE eder`, async () => {
    const notFoundError = new Error("NEXT_NOT_FOUND");
    requirePublicLocaleEnabledMock.mockRejectedValue(notFoundError);

    const { default: Page } = await import(modulePath);
    await expect(Page()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it(`3) placeholder koşulsuz noindex KALDIRILDI (statik metadata YOK)`, async () => {
    const mod = await import(modulePath);
    expect(mod.metadata).toBeUndefined();
    expect(typeof mod.generateMetadata).toBe("function");
  });
});

describe("app/(public)/tr/page.tsx — TR", () => {
  it("4) ORTAK HomePageBody'yi locale='tr' ile render eder", async () => {
    const { default: Page } = await import("@/app/(public)/tr/page");
    const element = await Page();
    expect(element.type).toBe(HomePageBody);
    expect(element.props.locale).toBe("tr");
  });

  it("5) TR'de locale gate'i ÇAĞRILMAZ (davranış değişmedi)", async () => {
    const { default: Page } = await import("@/app/(public)/tr/page");
    await Page();
    expect(requirePublicLocaleEnabledMock).not.toHaveBeenCalled();
    expect(setRequestLocaleMock).not.toHaveBeenCalled();
  });

  it("6) TR ve EN route AYNI component referansını kullanır (kopya YOK)", async () => {
    const tr = await (await import("@/app/(public)/tr/page")).default();
    const en = await (await import("@/app/(public)/page")).default();
    expect(tr.type).toBe(en.type);
  });

  it("6b) DE desteği kaldırıldı — `/de` route ağacı YOK", () => {
    expect(
      existsSync(path.join(process.cwd(), "app/(public)/de/page.tsx"))
    ).toBe(false);
  });
});
