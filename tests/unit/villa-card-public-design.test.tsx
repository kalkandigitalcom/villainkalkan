/* ===============================================================
   PUBLIC VİLLA KARTI — "petrol fiyat paneli" tasarım sistemi
   ===============================================================
   Yeni görsel yapının, mevcut veri/yönlendirme davranışlarını
   koruduğunu kilitler (default + discount variant).
   =============================================================== */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy, replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
  usePathname: () => "/",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
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
import { formatCurrency } from "@/lib/currency";

const BASE = {
  id: "v-1",
  slug: "terra-mila",
  title: "Terra Mila",
  location: "Fethiye / Kirme",
  price: 12000,
  currency: "TRY",
  images: ["https://cdn.example.com/a.jpg"],
  bedrooms: 2,
  bathrooms: 2,
  guests: 4,
  locale: "tr" as const,
};

beforeEach(() => {
  pushSpy.mockReset();
  cleanup();
});

describe("Public villa kartı — yeni tasarım", () => {
  it("1) kart detay sayfasına bağlı; ad, konum, kapasite gerçek veriden", () => {
    const { container } = render(<VillaCard {...BASE} />);
    expect(container.querySelector("a")!.getAttribute("href")).toBe("/kiralik-villa/terra-mila");
    expect(screen.getByRole("heading", { name: "Terra Mila" })).toBeTruthy();
    expect(screen.getByText("Fethiye / Kirme")).toBeTruthy();
    expect(screen.getByLabelText("4 kişi kapasitesi")).toBeTruthy();
    expect(screen.getByLabelText("2 yatak odası")).toBeTruthy();
    expect(screen.getByLabelText("2 banyo")).toBeTruthy();
    expect(container.querySelector('[data-villa-card="default"]')!.className).toContain("@container");
  });

  it("2) fiyat paneli: Gecelik + fiyat + 'Başlayan Fiyatlarla' + beyaz CTA (mavi panel)", () => {
    const { container } = render(<VillaCard {...BASE} />);
    const panel = container.querySelector("[data-price-panel]")!;
    expect(panel.textContent).toContain("Gecelik");
    expect(panel.textContent).toContain(formatCurrency(12000, "TRY", "tr"));
    expect(panel.textContent).toContain("Başlayan Fiyatlarla");
    const cta = screen.getByRole("button", { name: "Rezervasyon" });
    expect(cta.className).toContain("bg-white");
    expect(cta.className).toContain("text-brand");
  });

  it("3) sağ üst: takvim (müsaitlik) + favori; olmayan rozet/puan uydurulmaz", () => {
    render(<VillaCard {...BASE} />);
    expect(screen.getByLabelText("Müsaitlik ve tarih seçimi modalını aç")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Favori/i })).toBeTruthy();
    expect(screen.queryByText(/yorum/)).toBeNull();
    expect(screen.queryByText(/İNDİRİM/)).toBeNull();
  });

  it("4) villa rozeti ve gerçek puan varsa gösterilir", () => {
    render(<VillaCard {...BASE} badge="Kapalı ısıtmalı havuz" reviewAverage={4.86} reviewCount={23} />);
    expect(screen.getByText("Kapalı ısıtmalı havuz")).toBeTruthy();
    expect(screen.getByLabelText("Ortalama puan 4.9 / 5, 23 misafir yorumu")).toBeTruthy();
  });

  it("5) pasif villa (privateHref) → takvim/CTA özel sayfaya gider (modal yok)", () => {
    render(<VillaCard {...BASE} privateHref="/v/tok-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Rezervasyon" }));
    expect(pushSpy).toHaveBeenCalledWith("/v/tok-1");
    fireEvent.click(screen.getByLabelText("Müsaitlik ve tarih seçimi modalını aç"));
    expect(pushSpy).toHaveBeenLastCalledWith("/v/tok-1");
  });

  it("6) kısa-süreli tarihler (reserveInfo) → etiket + CTA reserveInfo.href", () => {
    render(<VillaCard {...BASE} reserveInfo={{ label: "12 Kas – 15 Kas", nights: 3, href: "/rezervasyon/terra-mila?start=2026-11-12&end=2026-11-15" }} />);
    expect(screen.getByText(/12 Kas – 15 Kas/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hemen rezervasyon yap" }));
    expect(pushSpy).toHaveBeenCalledWith("/rezervasyon/terra-mila?start=2026-11-12&end=2026-11-15");
  });

  it("7) esnek sonuç → fiyat yerine esnek tarih bilgisi", () => {
    const { container } = render(<VillaCard {...BASE} isFlexible />);
    const panel = container.querySelector("[data-price-panel]")!;
    expect(panel.textContent).toContain("Esnek Tarih Fırsatı");
    expect(panel.textContent).not.toContain(formatCurrency(12000, "TRY", "tr"));
  });

  it("8) EN: metinler ve detay bağlantısı /en", () => {
    const { container } = render(<VillaCard {...BASE} locale="en" />);
    expect(container.querySelector("a")!.getAttribute("href")).toBe("/en/kiralik-villa/terra-mila");
    expect(screen.getByRole("button", { name: "Book" })).toBeTruthy();
    expect(container.querySelector("[data-price-panel]")!.textContent).toContain("Starting From");
  });

  it("9) discount variant aynı sistem: mercan indirim şeridi + panelde indirimli fiyat", () => {
    const { container } = render(
      <VillaCard
        {...BASE}
        variant="discount"
        discount={{ start_date: "2026-11-08", end_date: "2026-11-14", discount_type: "percent", discount_value: 20, currency: null }}
      />
    );
    expect(container.querySelector('[data-villa-card="discount"]')).toBeTruthy();
    expect(screen.getByText("%20 İNDİRİM")).toBeTruthy();
    const panel = container.querySelector("[data-price-panel]")!;
    expect(panel.textContent).toContain(formatCurrency(9600, "TRY", "tr"));
    expect(panel.querySelector(".line-through")!.textContent).toContain(formatCurrency(12000, "TRY", "tr"));
  });
});

/* ===============================================================
   İKİ SÜTUNLU LİSTE YERLEŞİMİ — public villa kartı grid'leri
   ===============================================================
   Masaüstünde en fazla 2 kart yan yana; mobilde tek sütun. Sidebar'lı
   sayfalarda (arama / kiralık villalar) md'de tek, lg+ iki sütun. */
import { readFileSync } from "fs";

describe("Public villa listeleri — ikili düzen", () => {
  const GRIDS: Array<[string, RegExp]> = [
    ["app/components/search/AramaPageBody.tsx", /grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-x-6/g],
    ["app/components/search/KiralikVillalarPageBody.tsx", /grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-x-6/g],
    ["app/(public)/favoriler/FavoritesGrid.tsx", /grid grid-cols-1 sm:grid-cols-2 gap-x-6/g],
    ["app/components/villa/VillaList.tsx", /grid grid-cols-1 sm:grid-cols-2 gap-x-6/g],
    ["app/components/villa/SimilarVillasSection.tsx", /grid grid-cols-1 sm:grid-cols-2 gap-6/g],
    ["app/components/short-gaps/ShortGapsPageBody.tsx", /grid grid-cols-1 sm:grid-cols-2 gap-6/g],
    ["app/components/favorites/SharedFavoritesPageBody.tsx", /grid grid-cols-1 sm:grid-cols-2 gap-x-6/g],
    ["app/components/not-found/NotFoundContent.tsx", /grid grid-cols-1 sm:grid-cols-2 gap-6/g],
    ["app/components/shared-list/SharedListPageBody.tsx", /grid grid-cols-1 sm:grid-cols-2\s/g],
  ];
  it.each(GRIDS)("%s → masaüstünde 2 sütun, 3/4 sütun yok", (file, re) => {
    const src = readFileSync(file, "utf-8");
    expect(src).toMatch(re);
    expect(src).not.toMatch(/(lg|xl):grid-cols-[34]\b/);
  });
});
