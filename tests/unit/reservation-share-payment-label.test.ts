/* ===============================================================
   🛡️ /rezervasyon-kontrol — ÖDEME YÖNTEMİ ETİKETİ (EN/TR)
   ===============================================================
   Public audit bulgusu: etiket `"Kredi Kartı"` / `"Havale/EFT"` olarak
   hardcoded EN üretiliyordu ve TR/DE paylaşım görünümünde Türkçe
   kalıyordu. Artık CANONICAL `payment_methods.name` + MEVCUT generic
   `payment_method_translations` (migration 088) üzerinden çözülür.

   🔒 DOKUNULMAYAN: `payment_methods.name` canonical, `payment_methods.type`,
   `payment_method_id`, tutar/snapshot akışı, token/expiry semantiği.
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";

const resolveByTokenHashMock = vi.fn();
const findReservationForShareMock = vi.fn();
vi.mock("@/lib/db/reservation-share.repository.server", () => ({
  reservationShareRepository: {
    resolveByTokenHash: (...a: unknown[]) => resolveByTokenHashMock(...a),
    findReservationForShare: (...a: unknown[]) =>
      findReservationForShareMock(...a),
  },
}));

const getPaymentMethodNamesByLocaleMock = vi.fn();
vi.mock("@/lib/i18n/get-payment-method-translations.server", () => ({
  getPaymentMethodNamesByLocale: (...a: unknown[]) =>
    getPaymentMethodNamesByLocaleMock(...a),
}));

vi.mock("@/lib/storage.helpers", () => ({
  resolveVillaImageUrl: (u: string | null) => u,
}));

import { resolveReservationShare } from "@/app/(public)/rezervasyon-kontrol/share.resolve";

const PM_ID = "pm-1";

function row(overrides: Record<string, unknown> = {}) {
  return {
    reservation_no: "REZ-1",
    status: "confirmed",
    payment_link_status: null,
    payment_preference: "prepayment",
    name: "Ahmet",
    phone: "05551112233",
    email: "a@b.com",
    start_date: "2026-06-01",
    end_date: "2026-06-08",
    guests: 2,
    total_price: 1000,
    total_price_try: 1000,
    paid_amount: 200,
    prepayment_amount: 200,
    remaining_payment: 800,
    original_currency: "TRY",
    damage_deposit: null,
    cleaning_fee_try: null,
    pool_heating_selected: false,
    pool_heating_total_try: null,
    payment_method: { id: PM_ID, name: "Bank Transfer", type: "bank_transfer" },
    villa: { title: "Test Villa", villa_images: [] },
    ...overrides,
  };
}

async function label(locale?: "en" | "tr", pm?: unknown) {
  findReservationForShareMock.mockResolvedValue({
    data: [pm === undefined ? row() : row({ payment_method: pm })],
    error: null,
  });
  const res = await resolveReservationShare("tok", locale);
  if (res.kind !== "ok") throw new Error("beklenen ok, gelen: " + res.kind);
  return res.data.paymentMethodLabel;
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveByTokenHashMock.mockResolvedValue({ data: "res-1", error: null });
  getPaymentMethodNamesByLocaleMock.mockResolvedValue({
    [PM_ID]: { tr: "Havale / EFT" },
  });
});

describe("paymentMethodLabel — locale çözümü", () => {
  it("1) EN → canonical payment_methods.name", async () => {
    expect(await label("en")).toBe("Bank Transfer");
  });

  it("2) locale verilmezse varsayılan dil (EN) → canonical", async () => {
    expect(await label()).toBe("Bank Transfer");
  });

  it("3) TR → admin'in girdiği çeviri", async () => {
    expect(await label("tr")).toBe("Havale / EFT");
  });

  it("5) TR çeviri YOKSA canonical EN fallback", async () => {
    getPaymentMethodNamesByLocaleMock.mockResolvedValue({});
    expect(await label("tr")).toBe("Bank Transfer");
  });

  it.each(["", "   "])(
    "6) boş/whitespace çeviri → canonical EN fallback (%s)",
    async (v) => {
      getPaymentMethodNamesByLocaleMock.mockResolvedValue({
        [PM_ID]: { tr: v },
      });
      expect(await label("tr")).toBe("Bank Transfer");
    }
  );

  it("7) ödeme yöntemi yoksa null (parantez gösterilmez — eski davranış)", async () => {
    expect(await label("tr", null)).toBeNull();
  });

  it("8) adı boş olan yöntem → null", async () => {
    expect(
      await label("tr", { id: PM_ID, name: "   ", type: "bank_transfer" })
    ).toBeNull();
  });

  it("9) 🔒 EN'de çeviri sorgusu HİÇ atılmaz (ek DB maliyeti yok)", async () => {
    await label("en");
    expect(getPaymentMethodNamesByLocaleMock).not.toHaveBeenCalled();
  });

  it("10) 🔒 TR'de TEK batch çağrısı, tek id ile (N+1 yok)", async () => {
    await label("tr");
    expect(getPaymentMethodNamesByLocaleMock).toHaveBeenCalledTimes(1);
    expect(getPaymentMethodNamesByLocaleMock).toHaveBeenCalledWith([PM_ID]);
  });

  it("11) çeviri okuma hatası fail-soft → canonical EN, DTO bozulmaz", async () => {
    getPaymentMethodNamesByLocaleMock.mockRejectedValue(new Error("db"));
    expect(await label("tr")).toBe("Bank Transfer");
  });

  it("12) 🔒 hardcoded 'Kredi Kartı' / 'Havale/EFT' ÜRETİLMEZ (type'tan türetme yok)", async () => {
    const l = await label("en", {
      id: PM_ID,
      name: "Kredi Kartı (Sanal POS)",
      type: "credit_card",
    });
    expect(l).toBe("Kredi Kartı (Sanal POS)");
    expect(l).not.toBe("Kredi Kartı");
  });
});
