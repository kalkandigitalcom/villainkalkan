/* ===============================================================
   🛡️ PHASE 12C — SAYFA ÇEVİRİLERİ (pages) UI TESTLERİ
   ===============================================================
   `TypesPage.test.tsx` (Phase 10D Batch 3) ile AYNI mock-katman
   prensibi ve AYNI senaryo seti — Pages'in 5 çevrilebilir alanına
   (title / excerpt / body / seo_title / seo_description) uyarlandı.

   Kart `/maki-admin/pages/[id]` (Sayfayı düzenle) ekranında render
   edilir; testler gerçek edit sayfasını mount ederek hem
   `multilingual_enabled` kapısını hem kartın davranışını doğrular.

   ⚠️ Bu kart ADMIN ARAYÜZ DİLİNİ DEĞİŞTİRMEZ — admin Türkçe kalır.
   =============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/* ---------- mock katmanı ---------- */

const loadPageTranslationsMock = vi.fn();
const savePageTranslationMock = vi.fn();
vi.mock("@/app/(admin)/maki-admin/pages/[id]/page-translations.action", () => ({
  loadPageTranslationsAction: (...a: unknown[]) =>
    loadPageTranslationsMock(...a),
  savePageTranslationAction: (...a: unknown[]) => savePageTranslationMock(...a),
}));

const getPublicSettingsMock = vi.fn();
vi.mock("@/app/services/settings.action", () => ({
  getPublicSettingsAction: () => getPublicSettingsMock(),
}));

const adminFetchMock = vi.fn();
vi.mock("@/lib/admin-fetch", () => ({
  adminFetch: (...a: unknown[]) => adminFetchMock(...a),
}));

const notifyErrorMock = vi.fn();
const notifySuccessMock = vi.fn();
vi.mock("@/app/components/admin/notifications/NotificationProvider", () => ({
  useNotify: () => ({
    success: notifySuccessMock,
    error: notifyErrorMock,
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
  useConfirm: () => vi.fn().mockResolvedValue(false),
}));

vi.mock("@/app/services/revalidate.actions", () => ({
  revalidateMenu: vi.fn().mockResolvedValue(undefined),
  revalidateTaxonomy: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/activity-log.client", () => ({ logActivity: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ id: "page-uuid-1" }),
  usePathname: () => "/maki-admin/pages/page-uuid-1",
}));
vi.mock("@/lib/storage", () => ({ storageProvider: { upload: vi.fn() } }));
vi.mock("@/lib/storage.helpers", () => ({
  getPageCoverPublicUrl: () => null,
  buildPageCoverPath: () => "pages/x.webp",
  SITE_ASSETS_BUCKET_NAME: "site-assets",
}));
vi.mock("@/lib/image.helpers", () => ({ convertImageToWebP: vi.fn() }));

import EditPagePage from "@/app/(admin)/maki-admin/pages/[id]/page";

/* ---------- fixtures ---------- */

const PAGE_ID = "page-uuid-1";

const PAGE_ROW = {
  id: PAGE_ID,
  title: "An Unforgettable Holiday in Kas",
  slug: "kasta-unutulmaz-bir-tatil",
  body: "EN body",
  excerpt: "EN excerpt",
  seo_title: "EN seo",
  seo_description: "EN seo desc",
  noindex: false,
  is_active: true,
  show_in_menu: false,
  cover_image: null,
};

const TR_ROW = {
  id: "t-tr",
  page_id: PAGE_ID,
  locale: "tr",
  title: "Kaş'ta Unutulmaz Bir Tatil",
  excerpt: "Türkçe özet",
  body: "Türkçe gövde",
  seo_title: "TR SEO",
  seo_description: "TR SEO açıklama",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  adminFetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, data: PAGE_ROW }),
  });
  getPublicSettingsMock.mockResolvedValue({ multilingual_enabled: true });
  loadPageTranslationsMock.mockResolvedValue({ ok: true, rows: [] });
  savePageTranslationMock.mockResolvedValue({
    ok: true,
    row: { ...TR_ROW },
  });
});

async function renderEdit() {
  render(<EditPagePage />);
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Sayfayı düzenle" })
    ).toBeTruthy()
  );
}

const CARD_HEADING = "Türkçe Çeviri (TR)";

/** Kart görünür VE `loading` bitmiş (alanlar render edilmiş) olana
 *  kadar bekler — `findBy*` deterministiktir, `waitFor(heading)` kartın
 *  yalnız başlığını (yükleniyor durumunda da var) yakalar. */
async function cardReady() {
  await screen.findByText(CARD_HEADING);
  await screen.findByText("Türkçe sürümünü kaydet");
}

describe("Phase 12C — multilingual_enabled kapısı", () => {
  /* Site yapısal olarak iki dilli (EN `/`, TR `/tr`): eski
     `multilingual_enabled` değeri Türkçe çeviri kartını GİZLEMEZ. */
  it("1) multilingual_enabled=false → Türkçe çeviri kartı YİNE render edilir", async () => {
    getPublicSettingsMock.mockResolvedValue({ multilingual_enabled: false });
    await renderEdit();
    await cardReady();
    expect(loadPageTranslationsMock).toHaveBeenCalledWith(PAGE_ID);
  });

  it("2) settings null → kart YİNE render edilir", async () => {
    getPublicSettingsMock.mockResolvedValue(null);
    await renderEdit();
    await cardReady();
  });

  it("3) multilingual_enabled=true → kart render edilir ve çeviriler yüklenir", async () => {
    await renderEdit();
    await cardReady();
    expect(loadPageTranslationsMock).toHaveBeenCalledWith(PAGE_ID);
    expect(screen.getByText("Türkçe")).toBeTruthy();
    expect(screen.queryByText("Deutsch")).toBeNull();
    /* EN ana içerik referansı salt okunur gösterilir */
    expect(screen.getByText("English (ana içerik, salt okunur)")).toBeTruthy();
    expect(screen.getAllByText(PAGE_ROW.title).length).toBeGreaterThan(0);
  });
});

describe("Phase 12C — kayıtlı çevirilerin yüklenmesi", () => {
  it("4) kayıtlı EN çevirisi forma gelir", async () => {
    loadPageTranslationsMock.mockResolvedValue({
      ok: true,
      rows: [TR_ROW],
    });
    await renderEdit();
    await cardReady();

    expect(
      (screen.getByLabelText("Türkçe başlık") as HTMLInputElement).value
    ).toBe(TR_ROW.title);
    expect(
      (screen.getByLabelText("Türkçe kısa açıklama") as HTMLTextAreaElement)
        .value
    ).toBe("Türkçe özet");
    expect(
      (screen.getByLabelText("Türkçe içerik") as HTMLTextAreaElement).value
    ).toBe("Türkçe gövde");
    expect(
      (screen.getByLabelText("Türkçe SEO başlık") as HTMLInputElement).value
    ).toBe("TR SEO");
    expect(
      (screen.getByLabelText("Türkçe SEO açıklama") as HTMLTextAreaElement)
        .value
    ).toBe("TR SEO açıklama");
  });

  it("6) çeviri yoksa alanlar boş gelir", async () => {
    await renderEdit();
    await cardReady();
    expect(
      (screen.getByLabelText("Türkçe başlık") as HTMLInputElement).value
    ).toBe("");
  });

  it("7) yükleme hatası → toast.error 'Çeviriler yüklenemedi'", async () => {
    loadPageTranslationsMock.mockResolvedValue({
      ok: false,
      error: "Çeviriler okunamadı",
    });
    await renderEdit();
    await waitFor(() =>
      expect(
        notifyErrorMock.mock.calls.some(
          (c) => c[0] === "Çeviriler yüklenemedi"
        )
      ).toBe(true)
    );
  });
});

describe("Phase 12C — kayıt", () => {
  it("8) EN kaydet → doğru pageId/locale/5 alan ile çağrılır", async () => {
    await renderEdit();
    await cardReady();

    fireEvent.change(screen.getByLabelText("Türkçe başlık"), {
      target: { value: "Kaş'ta Unutulmaz Bir Tatil" },
    });
    fireEvent.change(screen.getByLabelText("Türkçe kısa açıklama"), {
      target: { value: "Türkçe özet" },
    });
    fireEvent.change(screen.getByLabelText("Türkçe içerik"), {
      target: { value: "Türkçe gövde" },
    });
    fireEvent.change(screen.getByLabelText("Türkçe SEO başlık"), {
      target: { value: "TR SEO" },
    });
    fireEvent.change(screen.getByLabelText("Türkçe SEO açıklama"), {
      target: { value: "TR SEO açıklama" },
    });

    fireEvent.click(screen.getByText("Türkçe sürümünü kaydet"));

    await waitFor(() => expect(savePageTranslationMock).toHaveBeenCalled());
    expect(savePageTranslationMock).toHaveBeenCalledWith({
      pageId: PAGE_ID,
      locale: "tr",
      title: "Kaş'ta Unutulmaz Bir Tatil",
      excerpt: "Türkçe özet",
      body: "Türkçe gövde",
      seoTitle: "TR SEO",
      seoDescription: "TR SEO açıklama",
      /* 🛡️ MIGRATION 091 — kart artık bölüm çevirisini de gönderir.
         Bu testte `canonicalSections` prop'u VERİLMEDİĞİ için canonical
         yapı boştur → `buildTranslatedSections` `null` döner ve public
         taraf canonical TR bölümlerine düşer. */
      sections: null,
    });
    await waitFor(() =>
      expect(notifySuccessMock).toHaveBeenCalledWith(
        "Türkçe çevirisi kaydedildi",
        expect.anything()
      )
    );
  });

  it("10) BOŞ çeviri kaydı güvenli — boş alanlarla çağrılır, hata yok", async () => {
    savePageTranslationMock.mockResolvedValue({
      ok: true,
      row: {
        ...TR_ROW,
        title: null,
        excerpt: null,
        body: null,
        seo_title: null,
        seo_description: null,
      },
    });
    await renderEdit();
    await cardReady();

    fireEvent.click(screen.getByText("Türkçe sürümünü kaydet"));
    await waitFor(() => expect(savePageTranslationMock).toHaveBeenCalled());
    expect(savePageTranslationMock).toHaveBeenCalledWith({
      pageId: PAGE_ID,
      locale: "tr",
      title: "",
      excerpt: "",
      body: "",
      seoTitle: "",
      seoDescription: "",
      /* 🛡️ MIGRATION 091 — boş kayıtta bölüm çevirisi de null. */
      sections: null,
    });
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Türkçe başlık") as HTMLInputElement).value
      ).toBe("")
    );
    expect(notifyErrorMock).not.toHaveBeenCalled();
  });

  it("11) kayıt sonrası sunucunun normalize ettiği değerlerle senkronlanır", async () => {
    savePageTranslationMock.mockResolvedValue({
      ok: true,
      row: { ...TR_ROW, title: "About Us" },
    });
    await renderEdit();
    await cardReady();

    fireEvent.change(screen.getByLabelText("Türkçe başlık"), {
      target: { value: "   About Us   " },
    });
    fireEvent.click(screen.getByText("Türkçe sürümünü kaydet"));

    await waitFor(() =>
      expect(
        (screen.getByLabelText("Türkçe başlık") as HTMLInputElement).value
      ).toBe("About Us")
    );
  });

  it("12) hata (Yetkisiz) → toast.error, form kaybolmaz", async () => {
    savePageTranslationMock.mockResolvedValue({
      ok: false,
      error: "Yetkisiz",
    });
    await renderEdit();
    await cardReady();

    fireEvent.click(screen.getByText("Türkçe sürümünü kaydet"));
    await waitFor(() =>
      expect(notifyErrorMock).toHaveBeenCalledWith(
        "Kaydedilemedi",
        expect.objectContaining({ description: "Yetkisiz" })
      )
    );
    expect(notifySuccessMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Türkçe başlık")).toBeTruthy();
  });

  it("13) TEKRAR kaydetme çalışır (idempotent, 2. çağrı)", async () => {
    await renderEdit();
    await cardReady();

    fireEvent.change(screen.getByLabelText("Türkçe başlık"), {
      target: { value: "v1" },
    });
    fireEvent.click(screen.getByText("Türkçe sürümünü kaydet"));
    await waitFor(() =>
      expect(savePageTranslationMock).toHaveBeenCalledTimes(1)
    );

    fireEvent.change(screen.getByLabelText("Türkçe başlık"), {
      target: { value: "v2" },
    });
    fireEvent.click(screen.getByText("Türkçe sürümünü kaydet"));
    await waitFor(() =>
      expect(savePageTranslationMock).toHaveBeenCalledTimes(2)
    );
    expect(savePageTranslationMock.mock.calls[1][0]).toMatchObject({
      title: "v2",
      locale: "tr",
    });
  });
});

describe("Phase 12C — mevcut TR davranışı korunuyor", () => {
  it("14) TR ana form alanları ve Kaydet butonu DEĞİŞMEDİ", async () => {
    await renderEdit();
    await cardReady();

    expect(screen.getByText("Başlık, içerik, SEO ve yayın durumu.")).toBeTruthy();
    expect(screen.getByDisplayValue(PAGE_ROW.title)).toBeTruthy();
    expect(screen.getByDisplayValue(PAGE_ROW.slug)).toBeTruthy();
    expect(screen.getByDisplayValue("EN body")).toBeTruthy();
    expect(screen.getByText("Yayın")).toBeTruthy();
    expect(screen.getByText("Kaydet")).toBeTruthy();
  });

  it("15) ana 'Kaydet' çeviri action'ını ÇAĞIRMAZ (akışlar ayrı)", async () => {
    await renderEdit();
    await cardReady();

    adminFetchMock.mockClear();
    fireEvent.click(screen.getByText("Kaydet"));
    await waitFor(() => expect(adminFetchMock).toHaveBeenCalled());
    expect(savePageTranslationMock).not.toHaveBeenCalled();
  });

  it("16) çeviri kaydı ana sayfa PUT'unu tetiklemez", async () => {
    await renderEdit();
    await cardReady();

    adminFetchMock.mockClear();
    fireEvent.click(screen.getByText("Türkçe sürümünü kaydet"));
    await waitFor(() => expect(savePageTranslationMock).toHaveBeenCalled());
    expect(adminFetchMock).not.toHaveBeenCalled();
  });
});
