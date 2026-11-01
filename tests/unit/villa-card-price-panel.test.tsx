/* ===============================================================
   2026-11: Aşağıdaki altın kavisli panel tasarımı artık YALNIZ
   "İndirimli Kiralık Villalar" kartında (variant="discount") — özgün
   haliyle kilitli. Normal villa kartı sade beyaz alt şeride geçti
   (dosya sonundaki "Normal villa kartı" bloğu).
   ---------------------------------------------------------------
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

function renderCard(withDates = false, variant: "default" | "discount" = "discount") {
  return render(
    <VillaCard locale="tr"
      variant={variant}
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

describe("🛡️ İndirimli kart (variant=discount) fiyat paneli — özgün tasarım AYNEN", () => {
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

  it("10px üst boşluk fiyat panelinin tamamında; fiyat bilgi grubunda değil", () => {
    const { container } = renderCard();
    const panel = panelOf(container);
    const info = container.querySelector("[data-price-info]")!;
    expect(cls(panel)).toContain("mt-[10px]");
    expect(cls(info)).not.toContain("mt-[10px]");
    expect(cls(info).some((x) => /^(@\[26rem\]:)?mt-/.test(x))).toBe(false);
    expect(info.parentElement).toBe(panel);
    expect(panel.firstElementChild).toBe(info);
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

/* 2026-11 — NORMAL VİLLA KARTI (öne çıkan / arama / kiralık villalar /
   favoriler / benzer villalar): beyaz, ince #E2E8F0 kenarlık, 16px köşe,
   gölgesiz; fiyat sade beyaz alt şeritte, lacivert CTA. */
describe("Normal villa kartı — sade tasarım", () => {
  it("kart: beyaz, ince kenarlık, 16px köşe; gölge / sıçrama yok", () => {
    const { container } = renderCard(false, "default");
    const c = cls(container.querySelector('[data-villa-card="default"]'));
    expect(c).toEqual(expect.arrayContaining(["bg-white", "rounded-[16px]", "!border-[#e2e8f0]"]));
    expect(c.some((x) => /shadow-|translate-y/.test(x))).toBe(false);
  });

  it("fiyat şeridi: altın dolgu/kavis yok; tutar lacivert; CTA lacivert hap", () => {
    const { container } = renderCard(false, "default");
    const c = cls(panelOf(container));
    expect(c).not.toContain("bg-brand");
    expect(c.some((x) => /rounded-tl-/.test(x))).toBe(false);
    expect(c).toContain("border-t");
    const amount = container.querySelector("[data-price-amount]")!;
    expect(amount.textContent).toMatch(/5\.400/);
    expect(cls(amount)).toContain("text-ink");
    expect(cls(amount)).not.toContain("text-white");
    const cta = Array.from(panelOf(container).querySelectorAll("button")).find(
      (b) => b.textContent === tr.card.reserve,
    )!;
    expect(cls(cta)).toEqual(expect.arrayContaining(["bg-ink", "text-white"]));
  });

  it("tarih seçiliyken toplam tutar lacivert", () => {
    const { container } = renderCard(true, "default");
    const amount = container.querySelector("[data-price-amount]")!;
    expect(amount.textContent).toMatch(/16\.200/);
    expect(cls(amount)).toContain("text-ink");
  });
});
