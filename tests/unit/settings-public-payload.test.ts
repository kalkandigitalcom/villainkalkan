/* ===============================================================
   🛡️ PHASE 10L §5/§13 — getPublicSettings PAYLOAD TESTLERİ
   ===============================================================
   KANITLANAN:
     • `multilingual_enabled` KAPALI → çeviri sorgusu HİÇ atılmaz ve
       dönen obje RPC'nin döndürdüğü AYNI REFERANSTIR (TR bit-bire
       aynılık — bugünkü production davranışı değişmedi).
     • AÇIK → çeviriler payload'a eklenir.
     • Çeviri okuma hata verirse public ÇÖKMEZ, çeviri eklenmez.
     • `get_public_settings` RPC'si KULLANILMAYA DEVAM EDER (düz
       `select("*")`'a DÜŞÜLMEDİ) → secret sızıntısı yolu açılmadı.
     • Çeviri payload'ında secret alan YOK.
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findPublicViaRpcMock = vi.fn();
const findSingletonMock = vi.fn();
const findSingletonIdMock = vi.fn();
const updateByIdMock = vi.fn();
const findAllForSettingsMock = vi.fn();

vi.mock("@/lib/db/settings.repository.server", () => ({
  settingsServerRepository: {
    findPublicViaRpc: (...a: unknown[]) => findPublicViaRpcMock(...a),
    findSingleton: (...a: unknown[]) => findSingletonMock(...a),
    findSingletonId: (...a: unknown[]) => findSingletonIdMock(...a),
    updateById: (...a: unknown[]) => updateByIdMock(...a),
  },
}));

vi.mock("@/lib/db/settings-translation.repository.server", () => ({
  settingsTranslationRepository: {
    findAllForSettings: (...a: unknown[]) => findAllForSettingsMock(...a),
    findOne: vi.fn(),
    upsertOne: vi.fn(),
    deleteOne: vi.fn(),
  },
}));

import { getPublicSettings } from "@/app/services/settings.service";

/* Türkçe çeviri satırı (İngilizce ana içerik `settings` tablosunda). */
const TR_ROW = {
  id: "row-tr",
  settings_id: "settings-1",
  locale: "tr",
  footer_copyright: "© {year} {site_name} · Tüm hakları saklıdır",
  default_meta_title: "Lüks Villa Kiralama",
  default_meta_description: "Özenle seçilmiş villalar.",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  findAllForSettingsMock.mockResolvedValue({ data: [TR_ROW], error: null });
});

describe("getPublicSettings — §5 çeviri payload'ı", () => {
  /* URL yapısı: EN kökte, TR /tr altında — site yapısal olarak iki dilli.
     `multilingual_enabled` kapalı/eksik olsa bile çeviriler payload'a eklenir
     (aksi halde kök İngilizce sayfalar Türkçe ayar metinleri gösterirdi). */
  it.each([
    ["multilingual KAPALI", { id: "settings-1", site_name: "Tatilin Yeri", multilingual_enabled: false }],
    ["multilingual alanı YOK", { id: "settings-1", site_name: "Tatilin Yeri" }],
  ])("1-2) %s → çeviriler yine payload'a eklenir", async (_l, rpcObject) => {
    findPublicViaRpcMock.mockResolvedValue({ data: rpcObject, error: null });

    const result = await getPublicSettings();

    expect(findAllForSettingsMock).toHaveBeenCalledWith("settings-1");
    expect(result?.site_name).toBe("Tatilin Yeri");
    expect(result?.translations?.tr?.footer_copyright).toBe(
      "© {year} {site_name} · Tüm hakları saklıdır"
    );
  });

  it("3) multilingual AÇIK → çeviriler payload'a eklenir", async () => {
    findPublicViaRpcMock.mockResolvedValue({
      data: { id: "settings-1", multilingual_enabled: true },
      error: null,
    });

    const result = await getPublicSettings();

    expect(findAllForSettingsMock).toHaveBeenCalledWith("settings-1");
    expect(result?.translations?.tr?.footer_copyright).toBe(
      "© {year} {site_name} · Tüm hakları saklıdır"
    );
    /* DE desteği kaldırıldı — payload'da `de` anahtarı YOK. */
    expect("de" in (result?.translations ?? {})).toBe(false);
  });

  /* 🛡️ MIGRATION 087 — 8 → 9 alan (`business_hours` eklendi;
     /iletisim EN sürümü "Çalışma Saatleri" metnini çözer). */
  it("4) çeviri payload'ı YALNIZ 9 alan taşır — id/settings_id/timestamp YOK", async () => {
    findPublicViaRpcMock.mockResolvedValue({
      data: { id: "settings-1", multilingual_enabled: true },
      error: null,
    });

    const result = await getPublicSettings();
    expect(Object.keys(result!.translations!.tr!).sort()).toEqual(
      [
        "default_meta_description",
        "default_meta_title",
        "footer_copyright",
        "hero_title",
        "hero_subtitle",
        "hero_badge_text",
        "hero_primary_cta_text",
        "hero_secondary_cta_text",
        "business_hours",
      ].sort()
    );
  });

  it("5) çeviri okuması hata verirse public ÇÖKMEZ, çeviri eklenmez", async () => {
    findPublicViaRpcMock.mockResolvedValue({
      data: { id: "settings-1", multilingual_enabled: true },
      error: null,
    });
    findAllForSettingsMock.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    const result = await getPublicSettings();
    expect(result?.id).toBe("settings-1");
    expect(result?.translations).toBeUndefined();
  });

  it("6) RPC hata verirse eski davranış AYNEN — null döner, çeviri sorgusu YOK", async () => {
    findPublicViaRpcMock.mockResolvedValue({
      data: null,
      error: { message: "rpc down" },
    });
    const result = await getPublicSettings();
    expect(result).toBeNull();
    expect(findAllForSettingsMock).not.toHaveBeenCalled();
  });

  it("7) secret alan çeviri payload'ına GİREMEZ (satırda olsa bile ayıklanır)", async () => {
    findPublicViaRpcMock.mockResolvedValue({
      data: { id: "settings-1", multilingual_enabled: true },
      error: null,
    });
    findAllForSettingsMock.mockResolvedValue({
      data: [{ ...TR_ROW, resend_api_key: "SECRET", mail_from: "x@y.z" }],
      error: null,
    });

    const result = await getPublicSettings();
    const payload = JSON.stringify(result?.translations);
    expect(payload).not.toContain("SECRET");
    expect(payload).not.toContain("resend_api_key");
    expect(payload).not.toContain("mail_from");
  });
});

/* ===============================================================
   §13 — PUBLIC OKUMA HÂLÂ RPC WHITELIST'İ ÜZERİNDEN
   =============================================================== */
describe("settings.service — RPC whitelist yolu DEĞİŞMEDİ", () => {
  it("8) getPublicSettings düz select değil, findPublicViaRpc kullanır", async () => {
    findPublicViaRpcMock.mockResolvedValue({
      data: { id: "settings-1" },
      error: null,
    });
    await getPublicSettings();
    expect(findPublicViaRpcMock).toHaveBeenCalledTimes(1);
    expect(findSingletonMock).not.toHaveBeenCalled();
  });

  it("9) kaynak metin kontrolü — findPublicViaRpc çağrısı duruyor, get_public_settings RPC adı repository'de", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const repo = readFileSync(
      join(process.cwd(), "lib/db/settings.repository.server.ts"),
      "utf-8"
    );
    expect(repo).toMatch(/dbAdmin\.rpc\("get_public_settings"\)/);
    /* findSingletonId YALNIZ id projeksiyonu — secret okumaz. */
    expect(repo).toMatch(/\.from\("settings"\)\s*\n\s*\.select\("id"\)/);
  });
});
