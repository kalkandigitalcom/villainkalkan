/* ===============================================================
   🎨 Public VillaCard fiyat paneli — geniş kartta %41 genişlik,
   140px sol-üst kavis, beyaz fiyat tutarı, fiyat grubunda 10px üst
   boşluk. Dar kartta mevcut responsive davranış (tam genişlik, 44px)
   korunur. İndirimli Koleksiyon'un özel kartları (A/B) bu panelden
   etkilenmez.
=============================================================== */

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { tr } from "@/lib/i18n/dictionaries/tr";

/* ---------------- VillaCard çevre mock'ları (kart testinin deseni) -------- */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
  usePathname: () => "/",
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("next/image", () => ({
  /* eslint-disable-next-line @next/next/no-img-element */
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ""} />,
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/app/context/CurrencyContext", () => ({
  useCurrency: () => ({ currency: "TRY", rates: { TRY: 1 } }),
}));

import VillaCard from "@/app/components/villa/VillaCard";

/* ---------------- fixtures — 08.10 → 11.10 = 3 GECE ---------------- */

function renderCard(withDates = false) {
  return render(
    <VillaCard
      id="v-1"
      slug="test-villa"
      title="Test Villa"
      location="Kalkan"
      price={5400}
      currency="TRY"
      stayStart={withDates ? "2026-10-08" : undefined}
      stayEnd={withDates ? "2026-10-11" : undefined}
      prices={[{ price: 5400, currency: "TRY", start_date: "2026-10-01", end_date: "2026-10-31" }]}
      cleaningFee={0}
      cleaningCurrency="TRY"
      cleaningLimit={0}
    />,
  );
}

const panelOf = (c: HTMLElement) => c.querySelector("[data-price-panel]") as HTMLElement;
const cls = (el: Element | null) => (el?.getAttribute("class") || "").split(/\s+/);

describe("Public VillaCard fiyat paneli", () => {
  it("geniş kart: %41 genişlik ve 140px sol-üst kavis; eski değerler yok", () => {
    const { container } = renderCard();
    const c = cls(panelOf(container));
    expect(c).toContain("@[26rem]:w-[41%]");
    expect(c).toContain("@[26rem]:rounded-tl-[140px]");
    expect(c).not.toContain("@[26rem]:w-[46%]");
    expect(c).not.toContain("@[26rem]:rounded-tl-[96px]");
  });

  it("dar kart: mevcut responsive davranış korunur (tam genişlik, 44px kavis)", () => {
    const { container } = renderCard();
    const c = cls(panelOf(container));
    expect(c).toContain("rounded-tl-[44px]");
    expect(c.some((x) => /^w-/.test(x))).toBe(false);
    expect(c).toContain("flex-col");
    expect(c).toContain("items-stretch");
  });

  it("gecelik fiyat tutarı (₺5.400) beyaz; 'Gecelik' ve 'Başlayan Fiyatlarla' mevcut stilde", () => {
    const { container } = renderCard();
    const amount = container.querySelector("[data-price-amount]")!;
    expect(amount.textContent).toMatch(/5\.400/);
    expect(cls(amount)).toContain("text-white");
    const info = container.querySelector("[data-price-info]")!;
    const nightly = Array.from(info.querySelectorAll("p")).find(
      (p) => p.textContent === tr.card.nightly,
    )!;
    const starting = Array.from(info.querySelectorAll("p")).find(
      (p) => p.textContent === tr.card.startingFromUpper,
    )!;
    expect(cls(nightly)).toContain("text-ink/90");
    expect(cls(nightly)).not.toContain("text-white");
    expect(cls(starting)).toContain("text-ink/85");
    expect(cls(starting)).not.toContain("text-white");
    /* Panelin kendisi beyaz metne çevrilmedi. */
    expect(cls(panelOf(container))).toContain("text-ink");
  });

  it("tarih seçiliyken toplam tutar da beyaz", () => {
    const { container } = renderCard(true);
    const amount = container.querySelector("[data-price-amount]")!;
    expect(amount.textContent).toMatch(/16\.200/);
    expect(cls(amount)).toContain("text-white");
  });

  it("fiyat grubu iç kapsayıcıda 10px üst boşluk; panelin kendisinde değil", () => {
    const { container } = renderCard();
    const panel = panelOf(container);
    const info = container.querySelector("[data-price-info]")!;
    expect(info.parentElement).toBe(panel);
    expect(panel.firstElementChild).toBe(info);
    expect(cls(info)).toContain("mt-[10px]");
    expect(cls(panel).some((x) => /^(@\[26rem\]:)?mt-/.test(x))).toBe(false);
    /* CTA aynı panelde, fiyat grubunun altında. */
    expect(info.nextElementSibling?.textContent).toBe(tr.card.reserve);
  });

  it("indirimli koleksiyonun özel kartları bu panel tasarımını kullanmaz", () => {
    for (const f of [
      "app/components/home/discount-cards/DiscountVillaCardA.tsx",
      "app/components/home/discount-cards/DiscountVillaCardB.tsx",
    ]) {
      const s = readFileSync(join(process.cwd(), f), "utf8");
      expect(s).not.toContain("rounded-tl-[140px]");
      expect(s).not.toContain("w-[41%]");
    }
  });
});
