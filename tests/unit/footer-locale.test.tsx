/* ===============================================================
   🛡️ PHASE 9B — FOOTER LOCALE DICTIONARY + WRAPPER PROP-PASSING TESTLERİ
   ===============================================================
   Hedef 1: app/components/layout/Footer.tsx (artık "use client")
   `usePathname()` + `localeFromPathname()` (Phase 9A) ile locale
   tespit edip `getDictionary(locale)` çağırıyor — Header.tsx (Phase
   9A) ile BİREBİR AYNI mekanizma. Bu grup, Footer'ı DOĞRUDAN (props
   ile, FooterWrapper olmadan) render ederek yalnızca locale/dictionary
   davranışını test eder.

   Hedef 2: app/components/layout/FooterWrapper.tsx (yeni async server
   component) — Footer'ın ÖNCEKİ (Phase 8'e kadar) veri-çekme mantığını
   BİREBİR taşıyor mu, doğru props'ları Footer'a geçiriyor mu. Bu grup
   `sitemap-locale-alternates.test.ts`'teki KANITLANMIŞ `vi.mock` +
   `vi.fn()` deseniyle DB/service katmanını mock'lar; GERÇEK DB'YE HİÇ
   DOKUNULMAZ.

   price-engine / discount / pool-heating / reservation testlerine HİÇ
   dokunulmadı. Href'ler test edilmiyor (bu fazda değişmediler — bkz.
   Phase 9B audit).
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/* ---------------- GRUP 1 — Footer (client) locale/dictionary ---------------- */

const usePathnameMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

import Footer from "@/app/components/layout/Footer";

const BASE_PROPS = {
  settings: null,
  locations: [],
  villaTypes: [],
  corporatePages: [],
  year: 2026,
  siteName: "Tatilin Yeri",
  phoneDigits: "",
};

describe("Footer — Phase 9B locale dictionary (props ile doğrudan render)", () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
  });

  it("1) TR path ('/') → TR footer dictionary metinleri", () => {
    usePathnameMock.mockReturnValue("/");
    render(<Footer {...BASE_PROPS} />);
    expect(screen.getByText("Kalkan'da Sizi Bekliyoruz")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bize Ulaşın" })).toBeInTheDocument();
  });

  it("1b) TR path ('/kiralik-villalar') → yine TR footer dictionary metinleri", () => {
    usePathnameMock.mockReturnValue("/kiralik-villalar");
    render(<Footer {...BASE_PROPS} />);
    expect(screen.getByText("Kalkan'da Sizi Bekliyoruz")).toBeInTheDocument();
  });

  it("2) '/en/kiralik-villalar' → EN footer dictionary metinleri (lib/i18n/dictionaries/en.ts değerleri)", () => {
    usePathnameMock.mockReturnValue("/en/kiralik-villalar");
    render(<Footer {...BASE_PROPS} />);
    expect(screen.queryByText("Kalkan'da Sizi Bekliyoruz")).not.toBeInTheDocument();
    expect(screen.getByText("We Look Forward to Welcoming You in Kalkan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact Us" })).toBeInTheDocument();
  });

  it("3) '/de/kiralik-villalar' → DE desteklenmiyor, TR footer metinlerine düşer", () => {
    usePathnameMock.mockReturnValue("/de/kiralik-villalar");
    render(<Footer {...BASE_PROPS} />);
    expect(screen.getByText("Kalkan'da Sizi Bekliyoruz")).toBeInTheDocument();
  });

  it("4) segment sınırı — '/energy-something' YANLIŞLIKLA 'en' ile eşleşmez, TR'ye düşer", () => {
    usePathnameMock.mockReturnValue("/energy-something");
    render(<Footer {...BASE_PROPS} />);
    expect(screen.getByText("Kalkan'da Sizi Bekliyoruz")).toBeInTheDocument();
  });

  it("5) Keşfet / marka / sosyal / rezervasyon sorgulama alanı footer'da yok", () => {
    usePathnameMock.mockReturnValue("/");
    render(<Footer {...BASE_PROPS} />);
    for (const t of ["Keşfet", "Villalar", "Bölgeler", "Tüm kategoriler", "Tüm bölgeleri keşfet", "Rezervasyon Sorgula"]) {
      expect(screen.queryByText(t)).not.toBeInTheDocument();
    }
  });

  /* 🛡️ NAVIGATION LOCALE PERSISTENCE — iç linkler AKTİF LOCALE'i taşır. */
  it("6) href'ler aktif locale'i taşır — EN path'te 'Contact Us' → '/en/iletisim'", () => {
    usePathnameMock.mockReturnValue("/en/kiralik-villalar");
    render(<Footer {...BASE_PROPS} />);
    const link = screen.getByRole("link", { name: "Contact Us" });
    expect(link).toHaveAttribute("href", "/en/iletisim");
    expect(link).not.toHaveAttribute("href", "/iletisim");
  });
});

/* ---------------- GRUP 2 — FooterWrapper (server) prop-passing ---------------- */

const getPublicSettingsMock = vi.fn();
const findAllVillaLocationsMock = vi.fn();
const findAllVillaTypesMock = vi.fn();
const findActivePagesMock = vi.fn();

vi.mock("@/app/services/settings.service", () => ({
  getPublicSettings: (...args: unknown[]) => getPublicSettingsMock(...args),
}));
vi.mock("@/lib/db/menu.repository", () => ({
  menuRepository: {
    findAllVillaLocations: (...args: unknown[]) =>
      findAllVillaLocationsMock(...args),
    findAllVillaTypes: (...args: unknown[]) =>
      findAllVillaTypesMock(...args),
  },
}));
vi.mock("@/lib/db/pages.repository", () => ({
  pagesRepository: {
    findActivePages: (...args: unknown[]) => findActivePagesMock(...args),
  },
}));

import FooterWrapper from "@/app/components/layout/FooterWrapper";

describe("FooterWrapper — Phase 9B prop-passing (DB/service mock'lanır, gerçek DB'ye dokunulmaz)", () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
    usePathnameMock.mockReturnValue("/");
    getPublicSettingsMock.mockReset();
    findAllVillaLocationsMock.mockReset();
    findAllVillaTypesMock.mockReset();
    findActivePagesMock.mockReset();
  });

  it("7) settings/villaTypes/locations/corporatePages başarıyla döner → Footer'a props olarak geçer ve render edilir", async () => {
    getPublicSettingsMock.mockResolvedValue({
      site_name: "Test Villa",
      phone: "+90 555 000 00 00",
      email: "info@example.com",
    });
    findAllVillaLocationsMock.mockResolvedValue({
      data: [{ id: "loc-1", name: "Kalkan", slug: "kalkan" }],
    });
    findAllVillaTypesMock.mockResolvedValue({
      data: [{ id: "type-1", name: "Havuzlu Villa", slug: "havuzlu-villa" }],
    });
    findActivePagesMock.mockResolvedValue({
      data: [
        {
          id: "page-1",
          title: "Hakkımızda",
          slug: "hakkimizda",
          menu_order: 1,
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const element = await FooterWrapper();
    render(element);

    /* Kurumsal (yasal) bağlantılar basılır; Keşfet alanı (bölge/villa
       tipi) artık footer'da YOK. */
    expect(screen.getByText("Hakkımızda")).toBeInTheDocument();
    expect(screen.queryByText("Kalkan")).not.toBeInTheDocument();
    expect(screen.queryByText("Havuzlu Villa")).not.toBeInTheDocument();
  });

  it("8) bir fetch reject olursa (Promise.allSettled) diğerleri etkilenmez — ÖNCEKİ davranış korunuyor", async () => {
    getPublicSettingsMock.mockRejectedValue(new Error("settings down"));
    findAllVillaLocationsMock.mockResolvedValue({
      data: [{ id: "loc-2", name: "Kaş", slug: "kas" }],
    });
    findAllVillaTypesMock.mockResolvedValue({ data: [] });
    findActivePagesMock.mockResolvedValue({ data: [] });

    const element = await FooterWrapper();
    render(element);

    /* settings reject oldu ama footer yine de render edildi. */
    expect(screen.getByText("Kalkan'da Sizi Bekliyoruz")).toBeInTheDocument();
    /* settings null olduğu için copyright fallback görünür. */
    expect(screen.getByText(/Tüm hakları saklıdır/)).toBeInTheDocument();
  });
});

/* ---------------- GRUP 3 — Phase 9C href regresyon kilidi ---------------- */

/* 🛡️ NAVIGATION LOCALE PERSISTENCE — SÖZLEŞME GÜNCELLEMESİ
   Phase 9C'de bu grup "locale ne olursa olsun TR path'lerine gitsin"
   davranışını kilitliyordu; o davranış EN/DE'de navigasyonda locale
   kaybına yol açıyordu. Testler SİLİNMEDİ: TR beklentileri AYNEN
   korunur (canonical prefix'siz), EN/DE beklentileri doğru davranışa
   (prefix'li) çevrildi ve "TR route'una düşmüyor" kontrolü eklendi.
   Query parametreleri ve token/slug kontratı DEĞİŞMEZ. */

const PROPS_WITH_TAXONOMY_AND_CMS = {
  settings: null,
  locations: [{ id: "loc-1", name: "Kalkan", slug: "kalkan" }],
  villaTypes: [{ id: "type-1", name: "Havuzlu Villa", slug: "havuzlu-villa" }],
  corporatePages: [
    {
      id: "page-1",
      title: "Hakkımızda",
      slug: "hakkimizda",
      menu_order: 1,
      created_at: "2024-01-01T00:00:00.000Z",
    },
  ],
  year: 2026,
  siteName: "Tatilin Yeri",
  phoneDigits: "",
};

describe("Footer — href locale kilidi (iç linkler aktif locale'i taşır)", () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
  });

  it("9-10) villa tipi / bölge bağlantıları footer'da basılmaz (Keşfet alanı kaldırıldı)", () => {
    usePathnameMock.mockReturnValue("/");
    const { container } = render(<Footer {...PROPS_WITH_TAXONOMY_AND_CMS} />);
    expect(screen.queryByRole("link", { name: "Havuzlu Villa" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Kalkan" })).toBeNull();
    expect(container.querySelector('a[href*="bolgeler"]')).toBeNull();
  });

  it("11) CMS (corporate page) href'i '/p/{slug}' yapısında — TR path'te", () => {
    usePathnameMock.mockReturnValue("/");
    render(<Footer {...PROPS_WITH_TAXONOMY_AND_CMS} />);
    const link = screen.getByRole("link", { name: "Hakkımızda" });
    expect(link).toHaveAttribute("href", "/p/hakkimizda");
  });

  it("12) CMS ve iletişim href'leri '/en/...' path'te '/en' prefix'i alır (slug kontratı AYNEN)", () => {
    usePathnameMock.mockReturnValue("/en/kiralik-villalar");
    render(<Footer {...PROPS_WITH_TAXONOMY_AND_CMS} />);
    expect(screen.getByRole("link", { name: "Hakkımızda" })).toHaveAttribute(
      "href",
      "/en/p/hakkimizda"
    );
    expect(screen.getByRole("link", { name: "Contact Us" })).toHaveAttribute(
      "href",
      "/en/iletisim"
    );
  });

  it("15) 'Bize Ulaşın' href TR path'te '/iletisim'", () => {
    usePathnameMock.mockReturnValue("/");
    render(<Footer {...BASE_PROPS} />);
    expect(screen.getByRole("link", { name: "Bize Ulaşın" })).toHaveAttribute("href", "/iletisim");
  });
});
