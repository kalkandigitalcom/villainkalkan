/* ===============================================================
   🛡️ PHASE 10D — Batch 1 — villa-type-translation.service.ts TESTLERİ
   ===============================================================
   villa-translation-service.test.ts (Phase 10A) ile AYNI desen —
   parent-existence pre-check YOK (villa-type repository'de findById
   yok). translationRepository MOCK'LANIR.
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
  type_id: "type-uuid-1",
  locale: "tr",
  name: "Test Type",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  findAllForParentMock.mockReset();
  upsertOneMock.mockReset();

  upsertOneMock.mockResolvedValue({ data: VALID_ROW, error: null });
  findAllForParentMock.mockResolvedValue({ data: [], error: null });
});

describe("upsertTypeTranslation", () => {
  it("TR upsert — geçerli girdi repository.upsertOne'a doğru argümanlarla ulaşır", async () => {
    const { upsertTypeTranslation } = await import(
      "@/app/services/villa-type-translation.service"
    );

    const result = await upsertTypeTranslation({
      typeId: "type-uuid-1",
      locale: "tr",
      name: "Test Type",
    });

    expect(result.ok).toBe(true);
    expect(upsertOneMock).toHaveBeenCalledWith(
      "villa_type",
      "type-uuid-1",
      "tr",
      { name: "Test Type" }
    );
  });

  it("locale 'de' artık reddedilir (DE desteği kaldırıldı) — repository çağrılmaz", async () => {
    const { upsertTypeTranslation } = await import(
      "@/app/services/villa-type-translation.service"
    );

    const result = await upsertTypeTranslation({
      typeId: "type-uuid-1",
      locale: "de",
      name: "Test Typ",
    });

    expect(result).toEqual({
      ok: false,
      error: "Geçersiz dil — yalnız 'tr' (Türkçe çeviri) desteklenir",
    });
    expect(upsertOneMock).not.toHaveBeenCalled();
  });

  it("mevcut TR çeviriyi günceller", async () => {
    const { upsertTypeTranslation } = await import(
      "@/app/services/villa-type-translation.service"
    );

    await upsertTypeTranslation({ typeId: "type-uuid-1", locale: "tr", name: "V1" });
    await upsertTypeTranslation({ typeId: "type-uuid-1", locale: "tr", name: "V2 güncel" });

    expect(upsertOneMock).toHaveBeenCalledTimes(2);
    expect(upsertOneMock).toHaveBeenLastCalledWith(
      "villa_type",
      "type-uuid-1",
      "tr",
      { name: "V2 güncel" }
    );
  });

  it("locale 'fr' reddedilir — repository çağrılmaz", async () => {
    const { upsertTypeTranslation } = await import(
      "@/app/services/villa-type-translation.service"
    );

    const result = await upsertTypeTranslation({
      typeId: "type-uuid-1",
      locale: "fr",
      name: "Type",
    });

    expect(result.ok).toBe(false);
    expect(upsertOneMock).not.toHaveBeenCalled();
  });

  it("locale 'en' reddedilir", async () => {
    const { upsertTypeTranslation } = await import(
      "@/app/services/villa-type-translation.service"
    );

    const result = await upsertTypeTranslation({
      typeId: "type-uuid-1",
      locale: "en",
      name: "Türkçe İsim",
    });

    expect(result.ok).toBe(false);
    expect(upsertOneMock).not.toHaveBeenCalled();
  });

  it("boş/geçersiz typeId reddedilir — repository çağrılmaz", async () => {
    const { upsertTypeTranslation } = await import(
      "@/app/services/villa-type-translation.service"
    );

    const result = await upsertTypeTranslation({
      typeId: "   ",
      locale: "tr",
      name: "Test",
    });

    expect(result.ok).toBe(false);
    expect(upsertOneMock).not.toHaveBeenCalled();
  });

  it("boş isim reddedilir (trim sonrası boş)", async () => {
    const { upsertTypeTranslation } = await import(
      "@/app/services/villa-type-translation.service"
    );

    const result = await upsertTypeTranslation({
      typeId: "type-uuid-1",
      locale: "tr",
      name: "   ",
    });

    expect(result.ok).toBe(false);
    expect(upsertOneMock).not.toHaveBeenCalled();
  });

  it("geçerli girdi repository'ye başarıyla ulaşır ve { ok: true, row } döner", async () => {
    const { upsertTypeTranslation } = await import(
      "@/app/services/villa-type-translation.service"
    );

    const result = await upsertTypeTranslation({
      typeId: "type-uuid-1",
      locale: "tr",
      name: "Test Type",
    });

    expect(result).toEqual({ ok: true, row: VALID_ROW });
  });
});

describe("getTypeTranslations", () => {
  it("yalnız en satırlarını döner (tr / eski de satırları filtrelenir)", async () => {
    findAllForParentMock.mockResolvedValueOnce({
      data: [
        { ...VALID_ROW, locale: "en" },
        { ...VALID_ROW, locale: "tr" },
        { ...VALID_ROW, locale: "de" },
      ],
      error: null,
    });

    const { getTypeTranslations } = await import(
      "@/app/services/villa-type-translation.service"
    );

    const result = await getTypeTranslations("type-uuid-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows.map((r) => r.locale).sort()).toEqual(["tr"]);
    }
  });

  it("boş/geçersiz typeId reddedilir — repository çağrılmaz", async () => {
    const { getTypeTranslations } = await import(
      "@/app/services/villa-type-translation.service"
    );

    const result = await getTypeTranslations("   ");

    expect(result.ok).toBe(false);
    expect(findAllForParentMock).not.toHaveBeenCalled();
  });
});
