/* ===============================================================
   🛡️ PHASE 9A — HEADER LOCALE DICTIONARY TESTS
   ===============================================================
   Hedef: app/components/layout/Header.tsx + lib/i18n/config.ts'in
   `localeFromPathname()`'i (Phase 9A).

   Header zaten "use client" ve `usePathname()` (next/navigation)
   kullanıyordu (Phase 9A audit'inde doğrulandı) — bu fazda YALNIZ
   dictionary kaynağı modül-seviyesi sabit `getDictionary(DEFAULT_LOCALE)`
   yerine, component gövdesinde `getDictionary(localeFromPathname(pathname))`
   oldu. Middleware/headers() KULLANILMADI (Footer'ın aksine — bkz.
   Phase 9A audit raporu, dynamic-rendering riski nedeniyle Footer bu
   fazın kapsamı DIŞINDA bırakıldı).

   Header'ın ağır, kendi veri/efekt mantığına sahip alt component'leri
   (TopBar, VillaSearchBox, HeaderFavoritesLink — üçü de "use client",
   kendi async/efekt akışlarına sahip) burada KASITLI OLARAK shallow
   mock'lanır: bu testlerin amacı SADECE dictionary/locale davranışı,
   o alt component'lerin kendi mantığı DEĞİL (onlar bu fazın kapsamı
   dışında, dokunulmadı — bkz. Phase 9A audit raporu §10).

   price-engine / discount / pool-heating / reservation testlerine
   HİÇ dokunulmadı.
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const usePathnameMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  /* Header dil çipleri (header redesign) query string'i korumak için
     useSearchParams kullanır. */
  useSearchParams: () => new URLSearchParams(),
}));

/* 🛡️ Ağır/veri-çeken alt component'ler shallow mock'lanır — bkz.
   dosya başı yorum. Gerçek default export'larının component olması
   yeterli (React onları render edebilsin diye); içerikleri bu testler
   için önemsiz. */
vi.mock("@/app/components/layout/TopBar", () => ({
  default: () => null,
}));
vi.mock("@/app/components/layout/VillaSearchBox", () => ({
  default: () => null,
}));
vi.mock("@/app/components/favorites/HeaderFavoritesLink", () => ({
  default: () => null,
}));

import Header from "@/app/components/layout/Header";
import FloatingQuoteCta from "@/app/components/layout/FloatingQuoteCta";

describe("Header — Phase 9A locale dictionary", () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
  });

  it("1) TR path ('/') → 'Teklif Al' (ÖNCEKİ sabit TR metin, DEĞİŞMEDİ)", () => {
    usePathnameMock.mockReturnValue("/tr");
    render(<FloatingQuoteCta />);
    expect(screen.getAllByText("Teklif Al").length).toBeGreaterThan(0);
  });

  it("2) TR path (villa detay örneği) → yine 'Teklif Al'", () => {
    usePathnameMock.mockReturnValue("/tr/kiralik-villa/ornek-slug");
    render(<FloatingQuoteCta />);
    expect(screen.getAllByText("Teklif Al").length).toBeGreaterThan(0);
  });

  it("3) '/...' path → 'Get a Quote' (EN dictionary)", () => {
    usePathnameMock.mockReturnValue("/kiralik-villa/ornek-slug");
    render(<FloatingQuoteCta />);
    expect(screen.getAllByText("Get a Quote").length).toBeGreaterThan(0);
    expect(screen.queryByText("Teklif Al")).not.toBeInTheDocument();
  });

  it("4) '/de/...' artık locale değil → varsayılan EN 'Get a Quote'", () => {
    usePathnameMock.mockReturnValue("/de/kiralik-villa/ornek-slug");
    render(<FloatingQuoteCta />);
    expect(screen.getAllByText("Get a Quote").length).toBeGreaterThan(0);
  });

  it("4b) Header artık 'Teklif Al' CTA'sı İÇERMEZ (sol kenardaki FloatingQuoteCta'ya taşındı)", () => {
    for (const p of ["/", "/kiralik-villalar"]) {
      usePathnameMock.mockReturnValue(p);
      const { container, unmount } = render(<Header menu={[]} siteLogo={null} />);
      expect(container.querySelector('a[href$="/tr/teklif-al"]')).toBeNull();
      for (const t of ["Teklif Al", "Get a Quote"]) {
        expect(screen.queryByText(t)).not.toBeInTheDocument();
      }
      unmount();
    }
  });

  it("4c) FloatingQuoteCta teklif sayfasının kendisinde render EDİLMEZ", () => {
    for (const p of ["/tr/teklif-al", "/teklif-al"]) {
      usePathnameMock.mockReturnValue(p);
      const { container, unmount } = render(<FloatingQuoteCta />);
      expect(container.querySelector("a")).toBeNull();
      unmount();
    }
  });

  it("5) menuOpen aria-label — EN path'te 'Open menu'", () => {
    usePathnameMock.mockReturnValue("/kiralik-villalar");
    render(<Header menu={[]} siteLogo={null} />);
    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
  });

  it("7) menuOpen aria-label — TR path'te ÖNCEKİ 'Menüyü aç' (regresyon)", () => {
    usePathnameMock.mockReturnValue("/tr/arama");
    render(<Header menu={[]} siteLogo={null} />);
    expect(screen.getByLabelText("Menüyü aç")).toBeInTheDocument();
  });

  it("8) segment sınırı — '/trabzon...' gibi yanlış-pozitif olabilecek bir path TR SAYILMAZ (EN)", () => {
    usePathnameMock.mockReturnValue("/trabzon-tasarrufu-ipuclari");
    render(<FloatingQuoteCta />);
    expect(screen.getAllByText("Get a Quote").length).toBeGreaterThan(0);
  });
});

/* ===============================================================
   🛡️ PHASE 9C — HREF REGRESYON KİLİDİ (locale'den bağımsız)
   ===============================================================
   PHASE 9C AUDIT KARARI: Header/Footer href'leri bu fazda
   DEĞİŞTİRİLMEDİ (bkz. Phase 9C audit raporu). Bu blok yalnızca
   BUGÜNKÜ href davranışını (locale ne olursa olsun TR path'lerine
   gitmesini) gelecekte yanlışlıkla bozulmaya karşı kilitler —
   dictionary/metin davranışına dokunmaz, yukarıdaki testlerle
   ÇAKIŞMAZ.
=============================================================== */
/* ===============================================================
   🛡️ NAVIGATION LOCALE PERSISTENCE — SÖZLEŞME GÜNCELLEMESİ
   ===============================================================
   Phase 9C'de bu blok "href locale'den BAĞIMSIZ, DEĞİŞMEZ" kuralını
   kilitliyordu. O kural, EN/DE'de bir iç linke tıklandığında
   prefix'siz TR route'una düşülmesine — yani locale'in navigasyonda
   KAYBOLMASINA — yol açıyordu (bildirilen hata).

   YENİ SÖZLEŞME: iç linkler AKTİF LOCALE'i taşır (`localeHref`).
   Aşağıdaki testler SİLİNMEDİ/GEVŞETİLMEDİ — TR davranışı aynen
   kilitli kalır, EN/DE beklentileri ise doğru davranışa çevrildi ve
   "prefix'siz TR route'una düşmüyor" kontrolü EKLENEREK sıkılaştırıldı.
   =============================================================== */
describe("Header — href locale kilidi (iç linkler aktif locale'i taşır)", () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
  });

  it("Logo href TR path'te '/tr' (TR ana sayfa)", () => {
    usePathnameMock.mockReturnValue("/tr");
    render(<Header menu={[]} siteLogo={null} />);
    const logoLink = screen.getByRole("link", { name: /Kiralama/i });
    expect(logoLink).toHaveAttribute("href", "/tr");
  });

  it("Logo href EN path'te '/' olur (locale KAYBOLMAZ)", () => {
    usePathnameMock.mockReturnValue("/kiralik-villa/ornek-slug");
    render(<Header menu={[]} siteLogo={null} />);
    const logoLink = screen.getByRole("link", { name: /Kiralama/i });
    expect(logoLink).toHaveAttribute("href", "/");
    expect(logoLink).not.toHaveAttribute("href", "/tr");
  });

  it("'Teklif Al' CTA href her zaman '/tr/teklif-al' — TR path'te", () => {
    usePathnameMock.mockReturnValue("/tr");
    render(<FloatingQuoteCta />);
    const ctaLinks = screen.getAllByRole("link", { name: "Teklif Al" });
    expect(ctaLinks.length).toBeGreaterThan(0);
    ctaLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/tr/teklif-al");
    });
  });

  it("CTA href '/...' path'te '/teklif-al' olur (metin VE hedef EN)", () => {
    usePathnameMock.mockReturnValue("/kiralik-villalar");
    render(<FloatingQuoteCta />);
    const ctaLinks = screen.getAllByRole("link", { name: "Get a Quote" });
    expect(ctaLinks.length).toBeGreaterThan(0);
    ctaLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/teklif-al");
      expect(link).not.toHaveAttribute("href", "/tr/teklif-al");
    });
  });
});
