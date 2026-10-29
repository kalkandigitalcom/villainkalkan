/* ===============================================================
   🛡️ PHASE 10D — Batch 1 — price-include-item-translation.service.ts TESTLERİ
   ===============================================================
   villa-translation-service.test.ts (Phase 10A) ile AYNI desen —
   parent-existence pre-check YOK (price-include-item repository'de
   findById yok). Çevrilebilir kolon `title` (`name` DEĞİL).
   translationRepository MOCK'LANIR.
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findAllForParentMock = vi.fn();
const upsertOneMock = vi.fn();

vi.mock("@/lib/db/translation.repository.server", () => ({
  translationRepository: {
    findAllForParent: (...args: unknown[]) => findAllForParentMock(...args),
    upsertOne: (...args: unknown[]) => upsertOneMock(...args),
  },
}));

const VALID_ROW = {
  id: "row-1",
  include_id: "include-uuid-1",
  locale: "tr",
  title: "Test Include",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  findAllForParentMock.mockReset();
  upsertOneMock.mockReset();

  upsertOneMock.mockResolvedValue({ data: VALID_ROW, error: null });
  findAllForParentMock.mockResolvedValue({ data: [], error: null });
});

describe("upsertPriceIncludeTranslation", () => {
  it("TR upsert — geçerli girdi repository.upsertOne'a doğru argümanlarla ulaşır", async () => {
    const { upsertPriceIncludeTranslation } = await import(
      "@/app/services/price-include-item-translation.service"
    );

    const result = await upsertPriceIncludeTranslation({
      includeId: "include-uuid-1",
      locale: "tr",
      title: "Test Include",
    });

    expect(result.ok).toBe(true);
    expect(upsertOneMock).toHaveBeenCalledWith(
      "price_include_item",
      "include-uuid-1",
      "tr",
      { title: "Test Include" }
    );
  });

  it("DE upsert — DE desteği kaldırıldı, reddedilir ve repository çağrılmaz", async () => {
    const { upsertPriceIncludeTranslation } = await import(
      "@/app/services/price-include-item-translation.service"
    );

    const result = await upsertPriceIncludeTranslation({
      includeId: "include-uuid-1",
      locale: "de",
      title: "Test Inklusive",
    });

    expect(result.ok).toBe(false);
    expect(upsertOneMock).not.toHaveBeenCalled();
  });

  it("mevcut TR çeviriyi günceller", async () => {
    const { upsertPriceIncludeTranslation } = await import(
      "@/app/services/price-include-item-translation.service"
    );

    await upsertPriceIncludeTranslation({ includeId: "include-uuid-1", locale: "tr", title: "V1" });
    await upsertPriceIncludeTranslation({ includeId: "include-uuid-1", locale: "tr", title: "V2 güncel" });

    expect(upsertOneMock).toHaveBeenCalledTimes(2);
    expect(upsertOneMock).toHaveBeenLastCalledWith(
      "price_include_item",
      "include-uuid-1",
      "tr",
      { title: "V2 güncel" }
    );
  });

  it("locale 'fr' reddedilir — repository çağrılmaz", async () => {
    const { upsertPriceIncludeTranslation } = await import(
      "@/app/services/price-include-item-translation.service"
    );

    const result = await upsertPriceIncludeTranslation({
      includeId: "include-uuid-1",
      locale: "fr",
      title: "Inclus",
    });

    expect(result.ok).toBe(false);
    expect(upsertOneMock).not.toHaveBeenCalled();
  });

  it("locale 'en' reddedilir", async () => {
    const { upsertPriceIncludeTranslation } = await import(
      "@/app/services/price-include-item-translation.service"
    );

    const result = await upsertPriceIncludeTranslation({
      includeId: "include-uuid-1",
      locale: "en",
      title: "Türkçe Başlık",
    });

    expect(result.ok).toBe(false);
    expect(upsertOneMock).not.toHaveBeenCalled();
  });

  it("boş/geçersiz includeId reddedilir — repository çağrılmaz", async () => {
    const { upsertPriceIncludeTranslation } = await import(
      "@/app/services/price-include-item-translation.service"
    );

    const result = await upsertPriceIncludeTranslation({
      includeId: "   ",
      locale: "tr",
      title: "Test",
    });

    expect(result.ok).toBe(false);
    expect(upsertOneMock).not.toHaveBeenCalled();
  });

  it("boş başlık reddedilir (trim sonrası boş)", async () => {
    const { upsertPriceIncludeTranslation } = await import(
      "@/app/services/price-include-item-translation.service"
    );

    const result = await upsertPriceIncludeTranslation({
      includeId: "include-uuid-1",
      locale: "tr",
      title: "   ",
    });

    expect(result.ok).toBe(false);
    expect(upsertOneMock).not.toHaveBeenCalled();
  });

  it("geçerli girdi repository'ye başarıyla ulaşır ve { ok: true, row } döner", async () => {
    const { upsertPriceIncludeTranslation } = await import(
      "@/app/services/price-include-item-translation.service"
    );

    const result = await upsertPriceIncludeTranslation({
      includeId: "include-uuid-1",
      locale: "tr",
      title: "Test Include",
    });

    expect(result).toEqual({ ok: true, row: VALID_ROW });
  });
});

describe("getPriceIncludeTranslations", () => {
  it("yalnız tr satırlarını döner (en/de varsa filtrelenir)", async () => {
    findAllForParentMock.mockResolvedValueOnce({
      data: [
        { ...VALID_ROW, locale: "en" },
        { ...VALID_ROW, locale: "tr" },
        { ...VALID_ROW, locale: "de" },
      ],
      error: null,
    });

    const { getPriceIncludeTranslations } = await import(
      "@/app/services/price-include-item-translation.service"
    );

    const result = await getPriceIncludeTranslations("include-uuid-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows.map((r) => r.locale).sort()).toEqual(["tr"]);
    }
  });

  it("boş/geçersiz includeId reddedilir — repository çağrılmaz", async () => {
    const { getPriceIncludeTranslations } = await import(
      "@/app/services/price-include-item-translation.service"
    );

    const result = await getPriceIncludeTranslations("   ");

    expect(result.ok).toBe(false);
    expect(findAllForParentMock).not.toHaveBeenCalled();
  });
});
