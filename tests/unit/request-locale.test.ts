/* ===============================================================
   🛡️ PHASE 4B — LOCALE CONTEXT CORE: REQUEST LOCALE STORE TESTS
   ===============================================================
   Hedef: lib/i18n/request-locale.server.ts

   React'ın `cache()`'i YALNIZ gerçek bir Next.js RSC request render'ı
   içinde (request-scoped dispatcher aktifken) memoize eder. Bu
   Vitest/Node ortamında böyle bir dispatcher YOK — `cache()` bu
   ortamda no-op/passthrough davranır (her çağrıda fabrika fonksiyonu
   yeniden çalışır; bkz. bu ortamda `node`ile yapılan ampirik prob:
   "factory ran" her çağrıda basıldı, aynı obje asla dönmedi).

   Bu yüzden burada `react`'ın `cache()`'i, GERÇEK Next.js request-
   scoping'ini modül düzeyinde SİMÜLE eden basit bir "bir kez çalıştır,
   modül ömrü boyunca sakla" mock'una çevrilir. `vi.resetModules()` ile
   HER testte modül SIFIRDAN import edilir — bu, her testi ayrı bir
   HTTP request'miş gibi izole eder (Next.js'te bu izolasyonu request-
   scoped dispatcher sağlar; production'daki GERÇEK request-izolasyonu
   React/Next.js'in kendi garantisidir, bu testin kapsamı DIŞINDA —
   tıpkı projenin zaten kullandığı `getVillaBySlugCached = cache(...)`
   deseninin kendisi için de ayrı bir "cache gerçekten dedupe ediyor
   mu" testi olmaması gibi).

   Mevcut price-engine / discount / pool-heating / reservation / TR
   route testlerine HİÇ dokunulmadı.
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T): T => {
      let hasRun = false;
      let cached: ReturnType<T>;
      return ((...args: Parameters<T>) => {
        if (!hasRun) {
          cached = fn(...args) as ReturnType<T>;
          hasRun = true;
        }
        return cached;
      }) as T;
    },
  };
});

beforeEach(() => {
  vi.resetModules();
});

describe("request-locale store", () => {
  it("setRequestLocale hiç çağrılmadıysa → getRequestLocale DEFAULT_LOCALE ('en') döner (EN route davranışı)", async () => {
    const { getRequestLocale } = await import(
      "@/lib/i18n/request-locale.server"
    );
    expect(getRequestLocale()).toBe("en");
  });

  it("setRequestLocale('tr') sonrası aynı request içinde getRequestLocale() 'tr' döner", async () => {
    const { setRequestLocale, getRequestLocale } = await import(
      "@/lib/i18n/request-locale.server"
    );
    setRequestLocale("tr");
    expect(getRequestLocale()).toBe("tr");
  });

  it("farklı 'request'ler (resetModules ile izole edilmiş modül instance'ları) birbirine SIZINTI yapmaz", async () => {
    const requestA = await import("@/lib/i18n/request-locale.server");
    requestA.setRequestLocale("tr");
    expect(requestA.getRequestLocale()).toBe("tr");

    vi.resetModules();

    const requestB = await import("@/lib/i18n/request-locale.server");
    /* requestB TAMAMEN farklı bir modül instance'ı (yeni request
       simülasyonu) — requestA'nın "tr" ayarından ETKİLENMEMELİ. */
    expect(requestB.getRequestLocale()).toBe("en");
  });
});
