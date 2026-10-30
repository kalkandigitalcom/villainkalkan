/* ===============================================================
   🛡️ PHASE 10E — BATCH 4 — AccommodationLayout TESTLERİ
   ===============================================================
   Hedef: app/components/villa/AccommodationLayout.tsx

   GERÇEK (mock'lanmamış) dictionary + GERÇEK
   villa-layout-label.helper / villa-layout.helper kullanılır — saf
   sunum component'i, DB/network'e hiç dokunmaz (distance-label ve
   dictionary testlerindeki AYNI "gerçek veriyle doğrula" prensibi).

   EN KRİTİK GRUP: "TR REGRESYON" — locale prop'u VERİLMEDEN yapılan
   mevcut çağrı (TR page.tsx'in bugünkü imzası) BİREBİR eski metinleri
   üretmeli.
=============================================================== */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import AccommodationLayout from "@/app/components/villa/AccommodationLayout";
import {
  BED_TYPE_LABELS,
  BATHROOM_TYPE_LABELS,
  type BedroomLayoutItem,
  type BathroomLayoutItem,
} from "@/lib/villa-layout.helper";

const BEDROOMS: BedroomLayoutItem[] = [
  { name: "Ana Yatak Odası", beds: [{ type: "double", count: 1 }] },
  { name: "Çocuk Odası", beds: [{ type: "bunk", count: 1 }] },
];
const BATHROOMS: BathroomLayoutItem[] = [
  { name: "1. Banyo", type: "full" },
  { name: "2. Banyo", type: "shower_wc" },
];

/* ---------------------------------------------------------------
   TR REGRESYON — mevcut çağrı imzası + birebir metinler
   --------------------------------------------------------------- */
describe("🛡️ TR REGRESYON", () => {
  it("locale='tr' ile render edilir", () => {
    render(
      <AccommodationLayout locale="tr" bedrooms={BEDROOMS} bathrooms={BATHROOMS} />
    );
    expect(screen.getByText("Konaklama Düzeni")).toBeInTheDocument();
  });

  it("TR oda/banyo adları AYNEN gösterilir", () => {
    render(<AccommodationLayout locale="tr" bedrooms={BEDROOMS} bathrooms={BATHROOMS} />);
    expect(screen.getByText("Ana Yatak Odası")).toBeInTheDocument();
    expect(screen.getByText("Çocuk Odası")).toBeInTheDocument();
    expect(screen.getByText("1. Banyo")).toBeInTheDocument();
    expect(screen.getByText("2. Banyo")).toBeInTheDocument();
  });

  it("TR bed type etiketleri mevcut BED_TYPE_LABELS ile BİREBİR aynı", () => {
    render(<AccommodationLayout locale="tr" bedrooms={BEDROOMS} bathrooms={[]} />);
    expect(
      screen.getByText(`1 ${BED_TYPE_LABELS.double}`)
    ).toBeInTheDocument();
    expect(screen.getByText(`1 ${BED_TYPE_LABELS.bunk}`)).toBeInTheDocument();
  });

  it("TR bathroom type etiketleri mevcut BATHROOM_TYPE_LABELS ile BİREBİR aynı", () => {
    render(<AccommodationLayout locale="tr" bedrooms={[]} bathrooms={BATHROOMS} />);
    expect(screen.getByText(BATHROOM_TYPE_LABELS.full)).toBeInTheDocument();
    expect(
      screen.getByText(BATHROOM_TYPE_LABELS.shower_wc)
    ).toBeInTheDocument();
  });

  it("TR isimsiz oda/banyo numara fallback'i eski formatla aynı", () => {
    render(
      <AccommodationLayout locale="tr"
        bedrooms={[{ name: "", beds: [{ type: "single", count: 1 }] }]}
        bathrooms={[{ name: "", type: "wc" }]}
      />
    );
    expect(screen.getByText("1. Yatak Odası")).toBeInTheDocument();
    expect(screen.getByText("1. Banyo")).toBeInTheDocument();
  });

  it("TR 'Detay belirtilmedi' fallback'i korunur", () => {
    render(
      <AccommodationLayout locale="tr"
        bedrooms={[{ name: "Oda", beds: [] }]}
        bathrooms={[]}
      />
    );
    expect(screen.getByText("Detay belirtilmedi")).toBeInTheDocument();
  });

  it("veri yoksa hiçbir şey render edilmez (mevcut davranış)", () => {
    const { container } = render(
      <AccommodationLayout locale="tr" bedrooms={[]} bathrooms={[]} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  /* 2026-10 referans düzeni: beyaz kart içinde iki sütunlu oda grid'i
     (mobilde tek sütun), her oda kendi çerçeveli kutusunda. */
  it("className/grid yapısı: beyaz kart + iki sütunlu oda grid'i", () => {
    const { container } = render(
      <AccommodationLayout locale="tr" bedrooms={BEDROOMS} bathrooms={BATHROOMS} />
    );
    expect(container.querySelector("section.bg-white")).toBeTruthy();
    const grid = container.querySelector(".grid.grid-cols-1.sm\\:grid-cols-2");
    expect(grid).toBeTruthy();
    expect(grid?.className).not.toContain("lg:grid-cols-3");
    expect(grid?.querySelectorAll(":scope > .rounded-2xl.border")).toHaveLength(4);
  });

  it("üst özet satırı oda/banyo/yatak toplamlarını gösterir", () => {
    render(
      <AccommodationLayout locale="tr" bedrooms={BEDROOMS} bathrooms={BATHROOMS} />
    );
    expect(
      screen.getByText(
        `2 Yatak Odası · 2 Banyo · 1 ${BED_TYPE_LABELS.double}, 1 ${BED_TYPE_LABELS.bunk}`
      )
    ).toBeInTheDocument();
  });
});

/* ---------------------------------------------------------------
   ENUM ETİKETLERİ — EN
   --------------------------------------------------------------- */
describe("enum etiketleri locale-aware", () => {
  it("EN bed type etiketleri", () => {
    render(
      <AccommodationLayout bedrooms={BEDROOMS} bathrooms={[]} locale="en" />
    );
    expect(screen.getByText("1 Double Bed")).toBeInTheDocument();
    expect(screen.getByText("1 Bunk Bed")).toBeInTheDocument();
  });

  it("EN bathroom type etiketleri", () => {
    render(
      <AccommodationLayout bedrooms={[]} bathrooms={BATHROOMS} locale="en" />
    );
    expect(screen.getByText("Full Bathroom")).toBeInTheDocument();
    expect(screen.getByText("Shower + WC")).toBeInTheDocument();
  });

  it("EN section başlığı ve fallback metinleri locale'e uyar", () => {
    render(
      <AccommodationLayout
        bedrooms={[{ name: "", beds: [] }]}
        bathrooms={[{ name: "", type: "wc" }]}
        locale="en"
      />
    );
    expect(screen.getByText("Accommodation Layout")).toBeInTheDocument();
    expect(screen.getByText("Bedroom 1")).toBeInTheDocument();
    expect(screen.getByText("Bathroom 1")).toBeInTheDocument();
    expect(screen.getByText("No details provided")).toBeInTheDocument();
  });

  it("bilinmeyen enum CRASH ETMEZ, güvenli fallback verir", () => {
    expect(() =>
      render(
        <AccommodationLayout
          bedrooms={[
            {
              name: "Oda",
              /* @ts-expect-error — bilinçli olarak geçersiz enum */
              beds: [{ type: "hammock", count: 2 }],
            },
          ]}
          /* @ts-expect-error — bilinçli olarak geçersiz enum */
          bathrooms={[{ name: "Banyo", type: "jacuzzi" }]}
          locale="en"
        />
      )
    ).not.toThrow();
    expect(screen.getByText("2 hammock")).toBeInTheDocument();
    expect(screen.getByText("jacuzzi")).toBeInTheDocument();
  });
});

/* ---------------------------------------------------------------
   🛡️ PHASE 10F — ODA/BANYO ADLARI ARTIK SÖZLÜKTEN
   ---------------------------------------------------------------
   Villa bazlı EN ad çevirisi KALDIRILDI (bedroomNames/bathroomNames
   prop'ları yok). Adlar merkezi `roomNameLabels` sözlüğünden çözülür;
   sözlükte olmayan serbest adlar olduğu gibi kalır.
   --------------------------------------------------------------- */
describe("oda/banyo adları — sözlük çözümü", () => {
  it("EN: canonical oda adları sözlükten çevrilir", () => {
    render(
      <AccommodationLayout bedrooms={BEDROOMS} bathrooms={[]} locale="en" />
    );
    expect(screen.getByText("Master Bedroom")).toBeInTheDocument();
    expect(screen.getByText("Children's Room")).toBeInTheDocument();
    expect(screen.queryByText("Ana Yatak Odası")).not.toBeInTheDocument();
  });

  it("EN: numaralı oda adı şablondan üretilir", () => {
    const numbered = [
      { name: "1. Yatak Odası", beds: [] },
      { name: "2. Yatak Odası", beds: [] },
    ];
    render(
      <AccommodationLayout bedrooms={numbered} bathrooms={[]} locale="en" />
    );
    expect(screen.getByText("Bedroom 1")).toBeInTheDocument();
    expect(screen.getByText("Bedroom 2")).toBeInTheDocument();
  });

  it("EN: numaralı banyo adı şablondan üretilir", () => {
    render(
      <AccommodationLayout bedrooms={[]} bathrooms={BATHROOMS} locale="en" />
    );
    expect(screen.getByText("Bathroom 1")).toBeInTheDocument();
    expect(screen.getByText("Bathroom 2")).toBeInTheDocument();
  });

  it("🛡️ sözlükte OLMAYAN serbest ad her locale'de olduğu gibi kalır", () => {
    const custom = [{ name: "Deniz Manzaralı Süit", beds: [] }];
    for (const locale of ["tr", "en"] as const) {
      const { unmount } = render(
        <AccommodationLayout bedrooms={custom} bathrooms={[]} locale={locale} />
      );
      expect(screen.getByText("Deniz Manzaralı Süit")).toBeInTheDocument();
      unmount();
    }
  });

  it("🛡️ villa bazlı çeviri prop'u ARTIK YOK — component yalnız locale alır", () => {
    /* bedroomNames/bathroomNames prop'ları kaldırıldı; TS seviyesinde de
       kabul edilmiyor (tsc bunu doğrular). Runtime'da fazladan prop
       gönderilse bile çıktı DEĞİŞMEZ. */
    const extra = { bedroomNames: ["HACKED"], bathroomNames: ["HACKED"] };
    render(
      <AccommodationLayout
        bedrooms={BEDROOMS}
        bathrooms={BATHROOMS}
        locale="en"
        {...(extra as unknown as Record<string, never>)}
      />
    );
    expect(screen.queryByText("HACKED")).not.toBeInTheDocument();
    expect(screen.getByText("Master Bedroom")).toBeInTheDocument();
  });

  it("adı boş satır numara fallback'ine düşer", () => {
    render(
      <AccommodationLayout
        bedrooms={[{ name: "", beds: [] }]}
        bathrooms={[]}
        locale="en"
      />
    );
    expect(screen.getByText("Bedroom 1")).toBeInTheDocument();
  });

  it("🛡️ ikonlar addan/locale'den ETKİLENMEZ", () => {
    const { container } = render(
      <AccommodationLayout
        bedrooms={BEDROOMS}
        bathrooms={BATHROOMS}
        locale="en"
      />
    );
    expect(container.querySelectorAll("svg")).toHaveLength(4);
  });
});
