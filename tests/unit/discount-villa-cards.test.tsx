/* ===============================================================
   İNDİRİMLİ VİLLA KARTLARI — Alternatif A / B (ana sayfa)
   ===============================================================
   Yeni iki kart tasarımının, eski `VillaCard variant="discount"` ile
   AYNI veri/hesap/yönlendirme davranışını koruduğunu kilitler:
     - İndirimli fiyat, üstü çizili eski fiyat, rozet yüzdesi,
       gecelik tasarruf ve geçerlilik etiketi (tek kaynak:
       computeDiscountCardPricing) — VillaCard ile birebir aynı metin
     - CTA: müsaitse /rezervasyon/<slug>?start&end, değilse detay
     - Detay bağlantısı ve TR/EN önekleri
     - İndirim yoksa düz fiyat; uydurma puan/rozet YOK
     - DiscountCollection: varsayılan tasarım, card_key, carousel
   =============================================================== */

import { describe, it, expect, vi } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import { readFileSync } from "fs";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
  usePathname: () => "/",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock("next/image", () => ({
  /* eslint-disable-next-line @next/next/no-img-element */
  default: ({ alt, src }: { alt?: string; src?: string }) => <img alt={alt ?? ""} src={src} />,
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/app/context/CurrencyContext", () => ({
  useCurrency: () => ({ currency: "TRY", rates: { TRY: 1 } }),
}));

import DiscountVillaCardA from "@/app/components/home/discount-cards/DiscountVillaCardA";
import DiscountVillaCardB from "@/app/components/home/discount-cards/DiscountVillaCardB";
import VillaCard from "@/app/components/villa/VillaCard";
import { DISCOUNT_CARD_DESIGN } from "@/app/components/home/discount-cards/discount-card-design";
import { formatCurrency } from "@/lib/currency";
import type { DiscountVillaCardProps } from "@/app/components/home/discount-cards/useDiscountCardModel";
import {
  HOME_PANEL_CLASS,
  HOME_PANEL_SECTION_CLASS,
} from "@/app/components/home/home-panel";

const DISCOUNT = {
  start_date: "2026-10-08",
  end_date: "2026-10-14",
  discount_type: "percent" as const,
  discount_value: 20,
  currency: null,
};

const BASE: DiscountVillaCardProps = {
  id: "v-1",
  slug: "ornek-villa",
  title: "Örnek Villa",
  location: "Kalkan",
  price: 10000,
  currency: "TRY",
  images: ["https://cdn.example.com/a.jpg"],
  bedrooms: 3,
  bathrooms: 2,
  guests: 6,
  discount: DISCOUNT,
  locale: "tr",
};

const CARDS = [
  ["A", DiscountVillaCardA],
  ["B", DiscountVillaCardB],
] as const;

const tr = (n: number) => formatCurrency(n, "TRY", "tr");

describe.each(CARDS)("Alternatif %s", (name, Card) => {
  it("1) indirimli fiyat belirgin, eski fiyat üstü çizili, rozet + tasarruf + tarih", () => {
    const { container } = render(<Card {...BASE} />);
    expect(container.querySelector(`[data-discount-card="${name.toLowerCase()}"]`)).toBeTruthy();
    expect(screen.getByText(tr(8000))).toBeTruthy();
    const old = screen.getByText(tr(10000), { exact: false });
    expect(old.className).toMatch(/line-through/);
    expect(screen.getAllByText("%20 İNDİRİM").length).toBeGreaterThan(0);
    expect(screen.getByText(`Gecelik ${tr(2000)} indirimli`)).toBeTruthy();
    expect(screen.getByText(/8 - 14 Ekim arası geçerli/)).toBeTruthy();
    expect(screen.getByText("İndirimsiz fiyat:", { exact: false }).className).toMatch(/sr-only/);
    cleanup();
  });

  it("2) CTA → /rezervasyon/<slug>?start&end; başlık → villa detayı", () => {
    render(<Card {...BASE} />);
    const cta = screen.getByRole("link", { name: /Hemen Rezervasyon Yap/ });
    expect(cta.getAttribute("href")).toBe(
      "/tr/rezervasyon/ornek-villa?start=2026-10-08&end=2026-10-14"
    );
    const heading = screen.getByRole("heading", { name: "Örnek Villa" });
    expect(within(heading).getByRole("link").getAttribute("href")).toBe("/tr/kiralik-villa/ornek-villa");
    cleanup();
  });

  it("3) pencere dolu (discountAvailable=false) → CTA villa detayına düşer", () => {
    render(<Card {...BASE} discountAvailable={false} />);
    expect(
      screen.getByRole("link", { name: /Hemen Rezervasyon Yap/ }).getAttribute("href")
    ).toBe("/tr/kiralik-villa/ornek-villa");
    cleanup();
  });

  it("4) EN → /en önekli bağlantılar ve EN metinleri", () => {
    render(<Card {...BASE} locale="en" />);
    expect(screen.getByRole("link", { name: /Book Now/ }).getAttribute("href")).toBe(
      "/rezervasyon/ornek-villa?start=2026-10-08&end=2026-10-14"
    );
    expect(screen.getAllByText("20% OFF").length).toBeGreaterThan(0);
    expect(
      within(screen.getByRole("heading", { name: "Örnek Villa" })).getByRole("link").getAttribute("href")
    ).toBe("/kiralik-villa/ornek-villa");
    cleanup();
  });

  it("5) indirim yoksa düz fiyat; rozet/eski fiyat/tasarruf UYDURULMAZ", () => {
    render(<Card {...BASE} discount={null} />);
    expect(screen.getByText(tr(10000))).toBeTruthy();
    expect(screen.queryByText(/İNDİRİM/)).toBeNull();
    expect(screen.queryByText(/indirimli/)).toBeNull();
    expect(screen.getByRole("link", { name: /Hemen Rezervasyon Yap/ }).getAttribute("href")).toBe(
      "/tr/kiralik-villa/ornek-villa"
    );
    cleanup();
  });

  it("6) fiyat yoksa 'Fiyat sorunuz'; görsel yoksa baş harf yer tutucu", () => {
    const { container } = render(<Card {...BASE} price={0} discount={null} images={[]} />);
    expect(screen.getByText("Fiyat sorunuz")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Görsel yakında")).toBeTruthy();
    cleanup();
  });

  it("7) fixed indirim → yüzde gerçek farktan hesaplanır", () => {
    render(
      <Card
        {...BASE}
        discount={{ ...DISCOUNT, discount_type: "fixed", discount_value: 7500, currency: "TRY" }}
      />
    );
    expect(screen.getByText(tr(7500))).toBeTruthy();
    expect(screen.getAllByText("%25 İNDİRİM").length).toBeGreaterThan(0);
    cleanup();
  });
});

describe("Puan — yalnız gerçek yorum verisiyle", () => {
  it("A: review_count > 0 ise ortalama + yorum sayısı; yoksa hiç", () => {
    render(<DiscountVillaCardA {...BASE} reviewAverage={4.86} reviewCount={23} />);
    expect(screen.getByLabelText("Ortalama puan 4.9 / 5, 23 misafir yorumu")).toBeTruthy();
    cleanup();
    render(<DiscountVillaCardA {...BASE} />);
    expect(screen.queryByText(/yorum/)).toBeNull();
    cleanup();
  });
});

describe("Parite — eski VillaCard discount branch ile aynı fiyat çıktısı", () => {
  it("indirimli/eski fiyat ve tasarruf metni birebir", () => {
    const { container } = render(
      <VillaCard variant="discount" {...BASE} discount={DISCOUNT} />
    );
    const legacy = container.textContent || "";
    cleanup();
    for (const [, Card] of CARDS) {
      const { container: c } = render(<Card {...BASE} />);
      for (const s of [tr(8000), tr(10000), `Gecelik ${tr(2000)} indirimli`, "8 - 14 Ekim arası geçerli"]) {
        expect(legacy).toContain(s);
        expect(c.textContent).toContain(s);
      }
      cleanup();
    }
  });
});

describe("Ana sayfa beyaz panelleri — ortak kap (home-panel.ts)", () => {
  it("panel sınıfı beyaz, yuvarlak köşeli, 1210px çizgide", () => {
    expect(HOME_PANEL_CLASS).toContain("max-w-site mx-auto");
    expect(HOME_PANEL_CLASS).toContain("bg-white");
    expect(HOME_PANEL_CLASS).toMatch(/rounded-\[24px\] md:rounded-\[28px\]/);
    expect(HOME_PANEL_SECTION_CLASS).toBe("px-5 md:px-10 lg:px-16 py-10 md:py-14");
  });
  it.each([
    ["app/components/home/DiscountCollection.tsx", "<HorizontalCarousel"],
    ["app/components/villa/VillaList.tsx", "<VillaCard"],
    ["app/components/home/HomepageReviewsSection.tsx", "<ReviewsCarousel"],
  ])("%s ortak paneli kullanır; içerik panelin içinde", (file, inner) => {
    const code = readFileSync(file, "utf-8");
    expect(code).toContain("className={HOME_PANEL_SECTION_CLASS}");
    const at = code.indexOf("className={HOME_PANEL_CLASS}");
    expect(at).toBeGreaterThan(-1);
    expect(code.indexOf(inner, at)).toBeGreaterThan(at);
  });
});

describe("DiscountCollection kaynak kilidi", () => {
  const src = readFileSync("app/components/home/DiscountCollection.tsx", "utf-8");
  it("ana sayfada tek tasarım: varsayılan DISCOUNT_CARD_DESIGN", () => {
    /* Onaylı tasarım "a" — "c" yalnız önizleme seçeneği. */
    expect(DISCOUNT_CARD_DESIGN).toBe("a");
    /* "c" = public kart tasarım sistemi (VillaCard variant="discount"). */
    expect(src).toMatch(/design === "c" \? \(\s*<VillaCard\s+variant="discount"/);
    expect(src).toMatch(/design = DISCOUNT_CARD_DESIGN/);
    expect(src).toMatch(/design === "b" \? DiscountVillaCardB : DiscountVillaCardA/);
  });
  it("bölüm beyaz, yuvarlatılmış bir panel içinde; başlık ve carousel panelde", () => {
    const panel = src.slice(src.indexOf("data-discount-panel"));
    expect(panel).toMatch(/className=\{HOME_PANEL_CLASS\}/);
    /* Başlık ana sayfa ortak başlığı (h2 + altın süs) üzerinden. */
    expect(panel.indexOf("<HomeSectionHeading")).toBeGreaterThan(-1);
    expect(panel.indexOf("<HorizontalCarousel")).toBeGreaterThan(
      panel.indexOf("<HomeSectionHeading"),
    );
  });
  it("veri kaynağı, carousel ve card_key korunur", () => {
    expect(src).toMatch(/getCachedDiscountCollectionVillas\(\)/);
    expect(src).toMatch(/<HorizontalCarousel/);
    expect(src).toMatch(/discountAvailable=\{c\.discount_available\}/);
    expect(src).toContain("key={c.card_key || c.slug || c.id}");
  });
  it("önizleme sayfası production'da 404 ve noindex", () => {
    const page = readFileSync("app/(public)/tr/onizleme/indirimli-villalar/page.tsx", "utf-8");
    expect(page).toMatch(/process\.env\.NODE_ENV === "production"\) notFound\(\)/);
    expect(page).toMatch(/index: false/);
  });
});
