/* ===============================================================
   🛡️ PHASE 4A — PUBLIC LOCALE ROUTING CORE: GATE TESTS
   ===============================================================
   Hedef: lib/i18n/public-locale-gate.server.ts (requirePublicLocaleEnabled)

   `next/navigation`'ın notFound() ve `lib/cache.helpers`'ın
   getCachedSettings() çağrıları mock'lanır — gerçek DB/Next request
   context'i KULLANILMAZ (aynı desen: translation-repository.test.ts).
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const getCachedSettingsMock = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

vi.mock("@/lib/cache.helpers", () => ({
  getCachedSettings: () => getCachedSettingsMock(),
}));

beforeEach(() => {
  notFoundMock.mockClear();
  getCachedSettingsMock.mockReset();
});

/* URL YAPISI: İngilizce varsayılan dil kökte (`/`), Türkçe `/tr` altında
   yaşar. Kök İngilizce sayfalar hiçbir ayar durumunda 404 OLMAMALI —
   `settings.multilingual_enabled` artık public erişimi kapatamaz. */
describe("requirePublicLocaleEnabled", () => {
  it.each([
    ["multilingual_enabled=false", () => getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: false })],
    ["multilingual_enabled=null", () => getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: null })],
    ["settings okunamıyor", () => getCachedSettingsMock.mockRejectedValue(new Error("db unreachable"))],
    ["multilingual_enabled=true", () => getCachedSettingsMock.mockResolvedValue({ multilingual_enabled: true })],
  ])("%s → notFound() ÇAĞRILMAZ (EN varsayılan dil her zaman açık)", async (_label, arrange) => {
    arrange();
    const { requirePublicLocaleEnabled } = await import(
      "@/lib/i18n/public-locale-gate.server"
    );
    await expect(requirePublicLocaleEnabled()).resolves.toBeUndefined();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
