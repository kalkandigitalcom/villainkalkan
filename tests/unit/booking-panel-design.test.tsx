/* ===============================================================
   🎨 Villa detay rezervasyon paneli — premium yerleşim kilidi
   (yalnız UI; tarih/fiyat/rezervasyon mantığı ayrı testlerde)
   =============================================================== */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";

vi.mock("@/app/services/settings.action", () => ({
  getPublicSettingsAction: vi.fn(async () => ({ prepayment_rate: 0 })),
}));

import BookingSidebar from "@/app/components/villa/BookingSidebar";
import type { VillaPriceEmbed } from "@/lib/villa-row.types";

const PRICES: VillaPriceEmbed[] = [
  { price: 4000, currency: "TRY", start_date: "2026-10-01", end_date: "2026-12-31" },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, ranges: [] }) })) as unknown as typeof fetch,
  );
});

const BASE = {
  villaSlug: "test-villa",
  villaId: "v1",
  prices: PRICES,
  cleaning_fee: 3500,
  cleaning_currency: "TRY",
  deposit: 5000,
  custom_prepayment_rate: 20,
};

describe("Rezervasyon paneli — premium tasarım", () => {
  it("üstte gecelik fiyat (mevcut para birimi biçimi) + '/ gece'", () => {
    const { container } = render(<BookingSidebar {...BASE} />);
    const nightly = container.querySelector("[data-booking-nightly]") as HTMLElement;
    expect(nightly.textContent).toContain("₺4.000");
    expect(nightly.textContent).toContain("/ gece");
    /* Büyük kutu yok — fiyat tipografiyle öne çıkar. */
    expect(nightly.className).not.toMatch(/(^|\s)(border|bg-)/);
  });

  it("fiyat yoksa başlık metni gösterilir, ₺0 basılmaz", () => {
    const { container } = render(<BookingSidebar {...BASE} prices={[]} />);
    expect(container.querySelector("[data-booking-nightly]")).toBeNull();
    expect(screen.getByRole("heading", { name: "Konaklamanızı planlayın" })).toBeInTheDocument();
  });

  it("giriş/çıkış yan yana, ikonlu; tüm alan tıklanabilir ve klavyeyle açılabilir", () => {
    const { container } = render(<BookingSidebar {...BASE} />);
    const field = container.querySelector("#booking-date-field") as HTMLElement;
    const trigger = within(field).getAllByRole("button")[0];
    expect(trigger.className).toContain("grid-cols-2");
    expect(trigger.querySelectorAll("svg")).toHaveLength(2);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger.textContent).toContain("Tarih seç");
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("misafir satırı aynı form grubunda; açılınca mevcut sayaçlar", () => {
    const { container } = render(<BookingSidebar {...BASE} />);
    const group = container.querySelector("[data-booking-fields]") as HTMLElement;
    const guests = within(group).getByRole("button", { name: /yetişkin/ });
    expect(guests).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(guests);
    expect(screen.getByText("Yetişkin")).toBeInTheDocument();
  });

  it("CTA: tam genişlik lacivert, beyaz yazı, altın detay; disabled/focus stilleri tanımlı", () => {
    render(<BookingSidebar {...BASE} />);
    const cta = screen.getByRole("button", { name: "Rezervasyon Yap" });
    expect(cta.className).toContain("w-full");
    expect(cta.className).toContain("bg-ink");
    expect(cta.className).toContain("text-white");
    expect(cta.className).toContain("disabled:bg-[var(--color-stone-200)]");
    expect(cta.className).toContain("focus-visible:ring-brand");
    expect(cta.querySelector(".bg-brand")).not.toBeNull();
    /* Etkinlik kuralı AYNEN (tarih yokken mevcut akış doğrulama mesajı verir). */
    expect(cta).toBeEnabled();
  });

  it("tarih seçiliyken döküm: ince ayırıcılı satırlar, belirgin toplam, depozito ayrı", async () => {
    const { container } = render(
      <BookingSidebar {...BASE} initialStart="2026-10-05" initialEnd="2026-10-10" />,
    );
    await screen.findByText("Toplam Tutar");
    const breakdown = container.querySelector("[data-booking-breakdown]") as HTMLElement;
    expect(breakdown.firstElementChild!.className).toContain("divide-y");
    const total = container.querySelector("[data-booking-total]") as HTMLElement;
    expect(total.textContent).toContain("₺23.500");
    expect(total.querySelector(".font-display")).not.toBeNull();
    const deposit = container.querySelector("[data-booking-deposit]") as HTMLElement;
    expect(deposit.textContent).toContain("₺5.000");
    /* Depozito toplama eklenmez (hesap aynı). */
    expect(breakdown.contains(deposit)).toBe(false);
  });
});
