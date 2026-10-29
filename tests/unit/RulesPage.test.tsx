/* ===============================================================
   🛡️ PHASE 10D — Batch 3 — Rules Admin Sayfası + Çeviri Paneli TESTLERİ
   ===============================================================
   FeaturesPage.test.tsx (Batch 2) ile AYNI mock-katman prensibi ve
   senaryo seti — yalnız Rule field'larına (title) uyarlandı.
   =============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const getRuleItemsMock = vi.fn();
const addRuleItemMock = vi.fn();
const updateRuleItemMock = vi.fn();
const deleteRuleItemMock = vi.fn();

vi.mock("@/app/(admin)/maki-admin/rules/rules.action", () => ({
  getRuleItemsAction: (...args: unknown[]) => getRuleItemsMock(...args),
  addRuleItemAction: (...args: unknown[]) => addRuleItemMock(...args),
  updateRuleItemAction: (...args: unknown[]) => updateRuleItemMock(...args),
  deleteRuleItemAction: (...args: unknown[]) => deleteRuleItemMock(...args),
}));

const loadRuleTranslationsMock = vi.fn();
const saveRuleTranslationMock = vi.fn();

vi.mock("@/app/(admin)/maki-admin/rules/rule-translations.action", () => ({
  loadRuleTranslationsAction: (...args: unknown[]) =>
    loadRuleTranslationsMock(...args),
  saveRuleTranslationAction: (...args: unknown[]) =>
    saveRuleTranslationMock(...args),
}));

const getPublicSettingsMock = vi.fn();
vi.mock("@/app/services/settings.action", () => ({
  getPublicSettingsAction: () => getPublicSettingsMock(),
}));

const notifyErrorMock = vi.fn();
const notifySuccessMock = vi.fn();
const confirmMock = vi.fn();

vi.mock("@/app/components/admin/notifications/NotificationProvider", () => ({
  useNotify: () => ({
    success: notifySuccessMock,
    error: notifyErrorMock,
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  }),
  useConfirm: () => confirmMock,
}));

import RulesPage from "@/app/(admin)/maki-admin/rules/page";

const RULES = [
  { id: "rule-1", title: "No smoking" },
  { id: "rule-2", title: "No pets allowed" },
];

function settingsWith(multilingual_enabled: boolean | null) {
  return { multilingual_enabled };
}

beforeEach(() => {
  getRuleItemsMock.mockReset();
  addRuleItemMock.mockReset();
  updateRuleItemMock.mockReset();
  deleteRuleItemMock.mockReset();
  loadRuleTranslationsMock.mockReset();
  saveRuleTranslationMock.mockReset();
  getPublicSettingsMock.mockReset();
  notifyErrorMock.mockReset();
  notifySuccessMock.mockReset();
  confirmMock.mockReset();

  getRuleItemsMock.mockResolvedValue(RULES);
  loadRuleTranslationsMock.mockResolvedValue({ ok: true, rows: [] });
  saveRuleTranslationMock.mockResolvedValue({
    ok: true,
    row: {
      id: "row-1",
      rule_id: "rule-1",
      locale: "tr",
      title: "Sigara içilmez",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  });
});

describe("RulesPage — Phase 10D Batch 3 — çeviri UI görünürlüğü", () => {
  it("1) multilingual_enabled=false → 'Çeviriler' butonu YİNE render edilir (site yapısal olarak iki dilli)", async () => {
    getPublicSettingsMock.mockResolvedValue(settingsWith(false));
    render(<RulesPage />);

    expect(await screen.findByDisplayValue("No smoking")).toBeInTheDocument();
    expect(
      (await screen.findAllByRole("button", { name: /çevirileri/i })).length
    ).toBeGreaterThan(0);
  });

  it("2) multilingual_enabled=null → buton YİNE görünür (Türkçe çeviri her zaman düzenlenebilir)", async () => {
    getPublicSettingsMock.mockResolvedValue(settingsWith(null));
    render(<RulesPage />);

    expect(await screen.findByDisplayValue("No smoking")).toBeInTheDocument();
    expect(
      (await screen.findAllByRole("button", { name: /çevirileri/i })).length
    ).toBeGreaterThan(0);
  });

  it("3) multilingual_enabled=true → 'Çeviriler' butonları render edilir", async () => {
    getPublicSettingsMock.mockResolvedValue(settingsWith(true));
    render(<RulesPage />);

    const btns = await screen.findAllByRole("button", { name: /çevirileri/i });
    expect(btns.length).toBe(2);
  });
});

describe("RulesPage — Phase 10D Batch 3 — panel açma/kapama + tab mekaniği", () => {
  it("4) 'Çeviriler' butonuna tıklanınca panel açılır", async () => {
    getPublicSettingsMock.mockResolvedValue(settingsWith(true));
    render(<RulesPage />);

    const btns = await screen.findAllByRole("button", { name: /çevirileri/i });
    fireEvent.click(btns[0]);

    expect(await screen.findByText("English (ana içerik, salt okunur)")).toBeInTheDocument();
  });

  it("5) Yalnız ilgili satırın paneli açılır", async () => {
    getPublicSettingsMock.mockResolvedValue(settingsWith(true));
    render(<RulesPage />);

    const btns = await screen.findAllByRole("button", { name: /çevirileri/i });
    fireEvent.click(btns[0]);
    await screen.findByText("English (ana içerik, salt okunur)");

    // Yalnız TEK panel açık: TR referans metni yalnız 1 kez görünür.
    expect(screen.getAllByText("English (ana içerik, salt okunur)").length).toBe(1);
  });

  it("6) İkinci satıra basınca önceki panel kapanır (tek panel açık)", async () => {
    getPublicSettingsMock.mockResolvedValue(settingsWith(true));
    render(<RulesPage />);

    const btns = await screen.findAllByRole("button", { name: /çevirileri/i });
    fireEvent.click(btns[0]);
    await screen.findByText("No smoking", { selector: "p" }).catch(() => {});
    fireEvent.click(btns[1]);

    await waitFor(() => {
      expect(screen.getAllByText("English (ana içerik, salt okunur)").length).toBe(1);
    });
    expect(screen.getByText("No pets allowed", { selector: "p" })).toBeInTheDocument();
  });

  it("7) EN tab çalışıyor (varsayılan aktif)", async () => {
    getPublicSettingsMock.mockResolvedValue(settingsWith(true));
    render(<RulesPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: /çevirileri/i }))[0]);

    expect(await screen.findByLabelText("Türkçe")).toBeInTheDocument();
    expect(screen.queryByLabelText("Deutsch")).not.toBeInTheDocument();
  });

  it("8) DE tab YOK (DE desteği kaldırıldı)", async () => {
    getPublicSettingsMock.mockResolvedValue(settingsWith(true));
    render(<RulesPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: /çevirileri/i }))[0]);
    await screen.findByLabelText("Türkçe");
    expect(screen.queryByRole("button", { name: "Deutsch" })).not.toBeInTheDocument();
  });
});

describe("RulesPage — Phase 10D Batch 3 — mevcut çeviri yükleme + kaydet", () => {
  it("9) Mevcut EN çevirisi input'a yüklenir", async () => {
    loadRuleTranslationsMock.mockResolvedValue({
      ok: true,
      rows: [
        {
          id: "row-en",
          rule_id: "rule-1",
          locale: "tr",
          title: "Sigara içilmez",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    getPublicSettingsMock.mockResolvedValue(settingsWith(true));
    render(<RulesPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: /çevirileri/i }))[0]);

    const enInput = (await screen.findByLabelText("Türkçe")) as HTMLInputElement;
    await waitFor(() => expect(enInput.value).toBe("Sigara içilmez"));
  });

  it("10) Kaydet → saveRuleTranslationAction doğru ruleId/locale/title ile çağrılır", async () => {
    getPublicSettingsMock.mockResolvedValue(settingsWith(true));
    render(<RulesPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: /çevirileri/i }))[0]);
    const input = await screen.findByLabelText("Türkçe");
    fireEvent.change(input, { target: { value: "Sigara içilmez" } });
    fireEvent.click(screen.getByRole("button", { name: /sürümünü kaydet/i }));

    await waitFor(() =>
      expect(saveRuleTranslationMock).toHaveBeenCalledWith({
        ruleId: "rule-1",
        locale: "tr",
        title: "Sigara içilmez",
      })
    );
  });

  it("11) Boş/trim input → action ÇAĞRILMAZ, hata toast gösterilir", async () => {
    getPublicSettingsMock.mockResolvedValue(settingsWith(true));
    render(<RulesPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: /çevirileri/i }))[0]);
    const input = await screen.findByLabelText("Türkçe");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /sürümünü kaydet/i }));

    await waitFor(() => expect(notifyErrorMock).toHaveBeenCalled());
    expect(saveRuleTranslationMock).not.toHaveBeenCalled();
  });

  it("12) Action hata döndürürse hata gösterilir", async () => {
    saveRuleTranslationMock.mockResolvedValue({ ok: false, error: "Yetkisiz" });
    getPublicSettingsMock.mockResolvedValue(settingsWith(true));
    render(<RulesPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: /çevirileri/i }))[0]);
    const input = await screen.findByLabelText("Türkçe");
    fireEvent.change(input, { target: { value: "Sigara içilmez" } });
    fireEvent.click(screen.getByRole("button", { name: /sürümünü kaydet/i }));

    await waitFor(() =>
      expect(notifyErrorMock).toHaveBeenCalledWith(
        "Kaydedilemedi",
        expect.objectContaining({ description: "Yetkisiz" })
      )
    );
    expect(notifySuccessMock).not.toHaveBeenCalled();
  });
});

describe("RulesPage — Phase 10D Batch 3 — regresyon + TR referans kuralı", () => {
  it("13) Mevcut Rule CRUD UI temel elemanları hâlâ render ediliyor", async () => {
    getPublicSettingsMock.mockResolvedValue(settingsWith(true));
    render(<RulesPage />);

    expect(await screen.findByDisplayValue("No smoking")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Kaydet$/i }).length).toBe(2);
    expect(screen.getAllByRole("button", { name: /^Sil$/i }).length).toBe(2);
    expect(
      screen.getByPlaceholderText("Kural adı (Örn: Sigara içilmez)")
    ).toBeInTheDocument();
  });

  it("TR referansı düzenlenebilir input olarak SUNULMUYOR — yalnız salt metin", async () => {
    getPublicSettingsMock.mockResolvedValue(settingsWith(true));
    render(<RulesPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: /çevirileri/i }))[0]);

    const trLabel = await screen.findByText("English (ana içerik, salt okunur)");
    const panel = trLabel.closest("div")?.parentElement as HTMLElement;
    expect(panel).toBeTruthy();

    const trText = within(panel).getByText("No smoking");
    expect(trText.tagName).not.toBe("INPUT");
    expect(trText.tagName).not.toBe("TEXTAREA");

    const inputs = within(panel).getAllByRole("textbox");
    expect(inputs.length).toBe(1);
  });
});
