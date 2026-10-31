/* ===============================================================
   🛡️ /v/[token] ↔ /kiralik-villa/[slug] — TASARIM PARİTESİ
   ===============================================================
   - Gizli link gövdesi normal detayın TEK KAYNAĞI `VillaDetailBody`
     ile render edilir: favori, sekmeler, yorumlar, benzer villalar,
     mobil CTA, giriş/çıkış, harita kartı AYNEN.
   - Off-market SEO: JSON-LD (application/ld+json) BASILMAZ.
   - Rezervasyon: aktif villada normal sayfayla aynı CTA; PASİF villada
     (rezervasyon sayfası pasif villayı açmaz) CTA gizli.
   - Normal detay: JSON-LD verildiğinde AYNEN basılır (çıktı değişmedi).
   - BottomNav: /v/ (+ /en|de/v/) yolunda gizli (tek alt bar).
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

const VILLA = {
  id: "villa-1",
  slug: "villa-lorien",
  title: "Villa Lorien",
  description: "<p>Aciklama.</p>",
  location: "Kalkan",
  location_id: "loc-1",
  is_active: true,
  bedrooms: 3,
  bathrooms: 2,
  guests: 6,
  cleaning_fee: null,
  cleaning_currency: null,
  cleaning_limit: null,
  deposit: null,
  custom_prepayment_rate: null,
  minimum_stay_nights: null,
  pool_type: "yok",
  indoor_pool: false,
  child_pool: false,
  pool_heating_fee: null,
  pool_heating_currency: null,
  pool_heating_months: null,
  map_type: null,
  map_embed: null,
  latitude: null,
  longitude: null,
  youtube_videos: [],
  bedroom_layout: [],
  bathroom_layout: [],
};
const state = { villa: { ...VILLA } as typeof VILLA };

vi.mock("@/app/services/villa.service", () => ({
  getVillaByPrivateToken: () => Promise.resolve(state.villa),
  getVillaBySlug: () => Promise.resolve(state.villa),
}));
vi.mock("@/app/services/villa-image/villa-image.read", () => ({
  getVillaImages: () =>
    Promise.resolve([{ id: "i1", image_url: "https://cdn.example/villa-1.webp" }]),
}));
vi.mock("@/app/services/villa-price.service", () => ({
  getVillaPrices: () => Promise.resolve([]),
}));
const discountsMock = vi.fn(() => Promise.resolve([]));
vi.mock("@/app/services/villa-discount.service", () => ({
  getVillaDiscounts: () => discountsMock(),
}));
vi.mock("@/app/services/villa-distance.service", () => ({
  getVillaDistances: () =>
    Promise.resolve([{ id: "d1", title: "Plaj", distance: "500 m" }]),
}));
vi.mock("@/app/services/villa-feature.service", () => ({
  getVillaFeaturesByVilla: () =>
    Promise.resolve([{ id: "f1", name: "Ozel Havuz" }]),
}));
vi.mock("@/app/services/rule-item.service", () => ({
  getRuleItemsByVilla: () =>
    Promise.resolve([{ id: "r1", title: "Evcil hayvan yok" }]),
}));
vi.mock("@/app/services/price-include-item.service", () => ({
  getPriceIncludeItemsByVilla: () =>
    Promise.resolve([{ id: "p1", title: "Havlu" }]),
}));
vi.mock("@/app/services/settings.service", () => ({
  getPublicSettings: () => Promise.resolve(null),
}));
const reviewsMock = vi.fn(() => Promise.resolve([]));
vi.mock("@/lib/cache.helpers", () => ({
  getCachedVillaReviews: () => reviewsMock(),
  getCachedSettings: () => Promise.resolve(null),
  getCachedVillaReviewStats: () => Promise.resolve({ count: 0, average: 0 }),
}));
const icalMock = vi.fn(() =>
  Promise.resolve({ checkin: [], checkout: [], middle: [] })
);
vi.mock("@/lib/external-calendar.public.helper", () => ({
  fetchExternalCalendarStringsForVilla: () => icalMock(),
  EMPTY_EXTERNAL_STRING_ARRAYS: Object.freeze({
    checkin: [],
    checkout: [],
    middle: [],
  }),
}));
vi.mock("@/lib/db/translation.repository.server", () => ({
  translationRepository: {
    findManyForLocale: () => Promise.resolve({ data: [], error: null }),
    findOne: () => Promise.resolve({ data: null, error: null }),
  },
}));
vi.mock("@/app/components/villa/SimilarVillasSection", () => ({
  default: () => <div data-testid="similar-villas-section" />,
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt?: string; src?: string }) => (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img alt={alt ?? ""} src={typeof src === "string" ? src : ""} />
  ),
}));
const pathname = { value: "/" };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
  usePathname: () => pathname.value,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/app/context/CurrencyContext", () => ({
  useCurrency: () => ({ currency: "TRY", rates: {} }),
}));

import PrivateVillaPageBody from "@/app/components/private-villa/PrivateVillaPageBody";
import BottomNav from "@/app/components/layout/BottomNav";
import NormalVillaDetail from "@/app/(public)/tr/kiralik-villa/[slug]/page";
import VillaInfoBar from "@/app/components/villa/VillaInfoBar";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary("tr");

async function renderPrivate() {
  const el = await PrivateVillaPageBody({
    params: Promise.resolve({ token: "tok-1" }),
    searchParams: Promise.resolve({}),
    locale: "tr",
  });
  return render(el as React.ReactElement);
}

beforeEach(() => {
  state.villa = { ...VILLA };
  pathname.value = "/";
  discountsMock.mockClear();
  reviewsMock.mockClear();
  icalMock.mockClear();
});

describe("/tr/v/[token] — normal villa detayıyla aynı gövde", () => {
  it("favori, sekmeler, yorumlar, benzer villalar, mobil CTA, giriş/çıkış render edilir", async () => {
    const { container } = await renderPrivate();
    expect(screen.getAllByLabelText(dict.favorites.add).length).toBeGreaterThan(0);
    /* Tek sekme navigasyonu: üst şerit (eski sekme bandı yok). */
    const tabsNav = screen.getByRole("navigation", { name: dict.villaTabs.sectionNavAriaLabel });
    expect(within(tabsNav).getByRole("button", { name: dict.villaTabs.prices })).toBeTruthy();
    expect(within(tabsNav).getByRole("button", { name: dict.villaTabs.features })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: dict.villaTabs.prices })).toHaveLength(1);
    /* Üst tanıtım bandında açıklama özeti YOK; asıl metin açıklama bölümünde. */
    const intro = container.querySelector("[data-villa-intro]")!;
    expect(intro.textContent).not.toContain("Aciklama.");
    expect(intro.querySelector("h1")!.textContent).toBe(VILLA.title);
    expect(document.getElementById("villa-aciklama")!.textContent).toContain("Aciklama.");
    expect(screen.getByText(dict.reviews.title)).toBeTruthy();
    expect(screen.getByTestId("similar-villas-section")).toBeTruthy();
    expect(screen.getByLabelText(dict.booking.mobileCtaAriaLabel)).toBeTruthy();
    expect(container.querySelector("#booking-sidebar")).not.toBeNull();
    /* 2026-10 — sidebar sadeleştirildi: giriş/çıkış saatleri, ödeme
       kolaylığı kartı ve "Nerede?" (Harita/Yol Tarifi) kartı yok. */
    const sidebar = container.querySelector("#booking-sidebar")!;
    expect(screen.queryByText(dict.villa.checkInOutTitle)).toBeNull();
    expect(sidebar.textContent).not.toContain(dict.booking.installmentEyebrow);
    expect(sidebar.textContent).not.toContain(dict.booking.payNowPerk);
    expect(sidebar.textContent).not.toContain(dict.booking.payAtCheckinPerk);
    expect(within(sidebar as HTMLElement).queryByRole("button", { name: dict.map.openMap })).toBeNull();
    expect(within(sidebar as HTMLElement).queryByRole("button", { name: dict.map.showOnMap })).toBeNull();
    /* Harita aksiyonu ana içerikteki Yakındaki Noktalar panelinde KALIR. */
    expect(screen.getByRole("button", { name: dict.map.showOnMap })).toBeTruthy();
    /* Normal detayla AYNI veri seti okunur. */
    expect(discountsMock).toHaveBeenCalledTimes(1);
    expect(icalMock).toHaveBeenCalledTimes(1);
    expect(reviewsMock).toHaveBeenCalledTimes(1);
  });

  it("off-market SEO: JSON-LD basılmaz", async () => {
    const { container } = await renderPrivate();
    expect(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).toHaveLength(0);
  });

  it("aktif villa → sidebar 'Rezervasyon Yap' butonu VAR (normal sayfayla aynı)", async () => {
    const { container } = await renderPrivate();
    const aside = container.querySelector("#booking-sidebar")!;
    const btns = Array.from(aside.querySelectorAll("button")).filter(
      (b) => b.textContent?.trim() === dict.booking.bookNow
    );
    expect(btns).toHaveLength(1);
  });

  it("pasif villa → sidebar 'Rezervasyon Yap' butonu GİZLİ", async () => {
    state.villa = { ...VILLA, is_active: false };
    const { container } = await renderPrivate();
    const aside = container.querySelector("#booking-sidebar")!;
    const btns = Array.from(aside.querySelectorAll("button")).filter(
      (b) => b.textContent?.trim() === dict.booking.bookNow
    );
    expect(btns).toHaveLength(0);
  });

  it("geçersiz token → notFound()", async () => {
    state.villa = null as unknown as typeof VILLA;
    await expect(renderPrivate()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("DOM paritesi — /v/[token] == /kiralik-villa/[slug] (JSON-LD hariç)", () => {
  const html = (c: HTMLElement) => {
    c.querySelectorAll('script[type="application/ld+json"]').forEach((n) =>
      n.remove()
    );
    return c.innerHTML;
  };

  it.each([true, false])(
    "aynı villa verisiyle BİREBİR aynı DOM (is_active=%s → yalnız pasifte CTA farkı)",
    async (active) => {
      state.villa = { ...VILLA, is_active: active };
      const normalEl = await NormalVillaDetail({
        params: Promise.resolve({ slug: VILLA.slug }),
        searchParams: Promise.resolve({}),
      });
      const normal = render(normalEl as React.ReactElement);
      /* Normal sayfa JSON-LD'yi AYNEN basar (çıktı değişmedi). */
      expect(
        normal.container.querySelectorAll('script[type="application/ld+json"]')
      ).toHaveLength(2);
      const normalHtml = html(normal.container);
      normal.unmount();

      const priv = await renderPrivate();
      const privHtml = html(priv.container);

      if (active) {
        expect(privHtml).toBe(normalHtml);
      } else {
        /* Pasif: tek fark sidebar'daki "Rezervasyon Yap" butonu. */
        expect(privHtml).not.toBe(normalHtml);
        const stripCta = (h: string) =>
          /* CTA artık ikon/yükleniyor öğeleri içerir → butonun tamamı
             (data-booking-cta) çıkarılır; metin hâlâ doğrulanır. */
          h.replace(/<button[^>]*data-booking-cta[^>]*>[\s\S]*?Rezervasyon Yap[\s\S]*?<\/button>/, "");
        expect(stripCta(privHtml)).toBe(stripCta(normalHtml));
      }
    }
  );
});

describe("Turizm belge numarası kaldırıldı", () => {
  const CERT = "07-1234";
  const infoGrid = (c: HTMLElement) =>
    c.querySelector("div.flex-1.min-w-0.grid") as HTMLElement | null;
  const docLine = (c: HTMLElement) =>
    c.querySelector("[data-villa-document-number]") as HTMLElement | null;
  /* Satırda eski bir değer kalmış olsa bile hiçbir yüzey göstermez. */
  const LEGACY = { ...VILLA, tourism_document_number: CERT } as typeof VILLA;

  it("normal detay → belge satırı / numarası yok", async () => {
    state.villa = LEGACY;
    const el = await NormalVillaDetail({
      params: Promise.resolve({ slug: VILLA.slug }),
      searchParams: Promise.resolve({}),
    });
    const { container } = render(el as React.ReactElement);
    expect(docLine(container)).toBeNull();
    expect(container.innerHTML).not.toContain(CERT);
    expect(container.textContent).not.toContain("Belge No");
  });

  it("/tr/v/[token] → belge satırı / numarası yok", async () => {
    state.villa = LEGACY;
    const { container } = await renderPrivate();
    expect(docLine(container)).toBeNull();
    expect(container.innerHTML).not.toContain(CERT);
  });

  it("/tr/v/[token] DOM'u = normal detay DOM'u", async () => {
    const strip = (c: HTMLElement) => {
      c.querySelectorAll('script[type="application/ld+json"]').forEach((n) => n.remove());
      return c.innerHTML;
    };
    const normalEl = await NormalVillaDetail({
      params: Promise.resolve({ slug: VILLA.slug }),
      searchParams: Promise.resolve({}),
    });
    const n = render(normalEl as React.ReactElement);
    const normalHtml = strip(n.container);
    n.unmount();
    const p = await renderPrivate();
    expect(strip(p.container)).toBe(normalHtml);
  });

  it.each([
    [{ guests: 6, bedrooms: 3, bathrooms: 2 }, 3, "grid-cols-3 md:grid-cols-3"],
    [{ guests: 6, bedrooms: 0, bathrooms: 2 }, 2, "grid-cols-2 md:grid-cols-2"],
    [{ guests: 6, bedrooms: 0, bathrooms: 0 }, 1, "grid-cols-1 md:grid-cols-1"],
  ])("VillaInfoBar kolon sayısı görünen kutu sayısına eşit (%o)", (v, count, cls) => {
    const { container } = render(
      <VillaInfoBar
        villaTitle="Villa Lorien"
        location="Kalkan"
        guests={v.guests}
        bedrooms={v.bedrooms}
        bathrooms={v.bathrooms}
      />
    );
    const grid = infoGrid(container)!;
    expect(grid.children).toHaveLength(count);
    expect(grid.className).toContain(cls);
    expect(container.innerHTML).not.toContain("turizm-bakanligi");
  });
});

describe("BottomNav — villa detayında tek alt bar", () => {
  it.each(["/tr/v/tok-1", "/v/tok-1", "/tr/kiralik-villa/x"])(
    "%s → BottomNav render edilmez",
    (p) => {
      pathname.value = p;
      const { container } = render(<BottomNav phoneHref={null} whatsappHref={null} />);
      expect(container.innerHTML).toBe("");
    }
  );
  it("diğer sayfalarda BottomNav AYNEN render edilir", () => {
    pathname.value = "/tr/arama";
    const { container } = render(<BottomNav phoneHref={null} whatsappHref={null} />);
    expect(container.innerHTML).not.toBe("");
  });
});
