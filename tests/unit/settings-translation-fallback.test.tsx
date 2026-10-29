/* ===============================================================
   🛡️ PHASE 10L / 10M — FALLBACK ZİNCİRİ + PUBLIC RENDER TESTLERİ
   ===============================================================
   Kapsam:
     A) `resolveSettingsText` (saf resolver, §6)
     B) Footer telif metni — locale-aware + {year}/{site_name} ikamesi (§7)
     C) TR BİT-BİRE AYNILIK REGRESYON KİLİDİ

   🛡️ PHASE 10M — Bakım ekranı testleri KALDIRILDI: bakım mesajı artık
   çevrilmiyor (çeviri kolonu migration 084 ile DROP edildi) ve ilgili
   client component silinip `app/(public)/layout.tsx` içine inline geri
   taşındı. Bakım ekranının CANONICAL davranışı (settings değeri +
   Türkçe varsayılan fallback) DEĞİŞMEDİ.

   `tests/unit/footer-locale.test.tsx` (Phase 9B) ile AYNI
   `usePathname` mock deseni — yeni bir test mimarisi İCAT EDİLMEDİ.
=============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const usePathnameMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

import { resolveSettingsText } from "@/lib/i18n/settings-translation.helper";
import type { SettingsTranslationsByLocale } from "@/lib/i18n/settings-translations.types";
import Footer from "@/app/components/layout/Footer";

const EN_COPYRIGHT = "© {year} {site_name} · All rights reserved.";
const TR_COPYRIGHT = "© {year} {site_name} · Tüm hakları saklıdır.";

const TRANSLATIONS: SettingsTranslationsByLocale = {
  tr: {
    footer_copyright: TR_COPYRIGHT,
    default_meta_title: "Lüks Villa Kiralama",
    default_meta_description: "Akdeniz kıyısında özenle seçilmiş villalar.",
    hero_title: null,
    hero_subtitle: null,
    hero_badge_text: null,
    hero_primary_cta_text: null,
    hero_secondary_cta_text: null,
    business_hours: null,
  },
};

/* ===============================================================
   A) resolveSettingsText — fallback zinciri
   =============================================================== */
describe("resolveSettingsText — §6 fallback zinciri", () => {
  it("1) locale 'en' → canonical AYNEN (aynı string referansı, trim YOK)", () => {
    const canonical = "  boşluklu canonical  ";
    const out = resolveSettingsText(
      canonical,
      TRANSLATIONS,
      "en",
      "footer_copyright"
    );
    expect(out).toBe(canonical);
  });

  it("2) locale 'en' → çeviri VARSA BİLE canonical döner", () => {
    expect(
      resolveSettingsText(EN_COPYRIGHT, TRANSLATIONS, "en", "footer_copyright")
    ).toBe(EN_COPYRIGHT);
  });

  it("3) locale 'en' + canonical null/undefined → AYNEN null/undefined (çağıranın falsy kontrolü korunur)", () => {
    expect(resolveSettingsText(null, TRANSLATIONS, "en", "footer_copyright")).toBeNull();
    expect(
      resolveSettingsText(undefined, TRANSLATIONS, "en", "footer_copyright")
    ).toBeUndefined();
  });

  it("4) locale 'tr' + çeviri var → çeviri", () => {
    expect(
      resolveSettingsText(EN_COPYRIGHT, TRANSLATIONS, "tr", "footer_copyright")
    ).toBe(TR_COPYRIGHT);
  });

  it("6) locale 'tr' + çeviri YOK (translations null) → EN canonical", () => {
    expect(
      resolveSettingsText(EN_COPYRIGHT, null, "tr", "footer_copyright")
    ).toBe(EN_COPYRIGHT);
    expect(
      resolveSettingsText(EN_COPYRIGHT, undefined, "tr", "footer_copyright")
    ).toBe(EN_COPYRIGHT);
  });

  it("7) locale 'tr' + o dil hiç yok ({}) → EN canonical", () => {
    expect(
      resolveSettingsText(
        EN_COPYRIGHT,
        {},
        "tr",
        "footer_copyright"
      )
    ).toBe(EN_COPYRIGHT);
  });

  it("8) çeviri null → EN canonical", () => {
    const partial: SettingsTranslationsByLocale = {
      tr: {
        footer_copyright: null,
        default_meta_title: null,
        default_meta_description: null,
        hero_title: null,
    hero_subtitle: null,
    hero_badge_text: null,
    hero_primary_cta_text: null,
    hero_secondary_cta_text: null,
    business_hours: null,
  },
    };
    expect(
      resolveSettingsText(EN_COPYRIGHT, partial, "tr", "footer_copyright")
    ).toBe(EN_COPYRIGHT);
  });

  it("9) çeviri '' veya yalnız boşluk → EN canonical", () => {
    for (const empty of ["", "   ", "\n\t"]) {
      const partial: SettingsTranslationsByLocale = {
        tr: {
          footer_copyright: empty,
          default_meta_title: null,
          default_meta_description: null,
          hero_title: null,
    hero_subtitle: null,
    hero_badge_text: null,
    hero_primary_cta_text: null,
    hero_secondary_cta_text: null,
    business_hours: null,
    },
      };
      expect(
        resolveSettingsText(EN_COPYRIGHT, partial, "tr", "footer_copyright")
      ).toBe(EN_COPYRIGHT);
    }
  });

  it("10) her alan BAĞIMSIZ çözülür (biri çevrili, diğeri değil)", () => {
    const partial: SettingsTranslationsByLocale = {
      tr: {
        footer_copyright: TR_COPYRIGHT,
        default_meta_title: "Luxury Villa Rentals",
        default_meta_description: "",
        hero_title: null,
    hero_subtitle: null,
    hero_badge_text: null,
    hero_primary_cta_text: null,
    hero_secondary_cta_text: null,
    business_hours: null,
  },
    };
    expect(
      resolveSettingsText(EN_COPYRIGHT, partial, "tr", "footer_copyright")
    ).toBe(TR_COPYRIGHT);
    expect(
      resolveSettingsText("EN başlık", partial, "tr", "default_meta_title")
    ).toBe("Luxury Villa Rentals");
    expect(
      resolveSettingsText("EN açıklama", partial, "tr", "default_meta_description")
    ).toBe("EN açıklama");
  });
});

/* ===============================================================
   B) Footer — §7
   =============================================================== */
const FOOTER_BASE = {
  locations: [],
  villaTypes: [],
  corporatePages: [],
  year: 2026,
  siteName: "Tatilin Yeri",
  phoneDigits: "",
};

describe("Footer — footer_copyright locale-aware (§7)", () => {
  beforeEach(() => usePathnameMock.mockReset());

  it("11) EN — canonical metin, {year}/{site_name} ikamesi AYNEN", () => {
    usePathnameMock.mockReturnValue("/");
    render(
      <Footer
        {...FOOTER_BASE}
        settings={{ footer_copyright: EN_COPYRIGHT, translations: TRANSLATIONS }}
      />
    );
    expect(
      screen.getByText("© 2026 Tatilin Yeri · All rights reserved.")
    ).toBeInTheDocument();
  });

  it("12) TR — çeviri kullanılır ve yer tutucular ÇEVİRİDE DE ikame edilir", () => {
    usePathnameMock.mockReturnValue("/tr/kiralik-villalar");
    render(
      <Footer
        {...FOOTER_BASE}
        settings={{ footer_copyright: EN_COPYRIGHT, translations: TRANSLATIONS }}
      />
    );
    expect(
      screen.getByText("© 2026 Tatilin Yeri · Tüm hakları saklıdır.")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("© 2026 Tatilin Yeri · All rights reserved.")
    ).not.toBeInTheDocument();
  });

  it("13) EN alt sayfa ('/kiralik-villalar') → EN canonical metin (TR sızmaz)", () => {
    usePathnameMock.mockReturnValue("/kiralik-villalar");
    render(
      <Footer
        {...FOOTER_BASE}
        settings={{ footer_copyright: EN_COPYRIGHT, translations: TRANSLATIONS }}
      />
    );
    expect(
      screen.getByText("© 2026 Tatilin Yeri · All rights reserved.")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("© 2026 Tatilin Yeri · Tüm hakları saklıdır.")
    ).not.toBeInTheDocument();
  });

  it("14) TR + çeviri YOK → EN canonical metin gösterilir", () => {
    usePathnameMock.mockReturnValue("/tr");
    render(
      <Footer
        {...FOOTER_BASE}
        settings={{ footer_copyright: EN_COPYRIGHT, translations: null }}
      />
    );
    expect(
      screen.getByText("© 2026 Tatilin Yeri · All rights reserved.")
    ).toBeInTheDocument();
  });

  it("15) TR sayfa: canonical BOŞ + çeviri yok → sözlük (TR) fallback", () => {
    usePathnameMock.mockReturnValue("/tr");
    render(<Footer {...FOOTER_BASE} settings={{ footer_copyright: "" }} />);
    expect(
      screen.getByText("© 2026 Tatilin Yeri · Tüm hakları saklıdır")
    ).toBeInTheDocument();
  });

  it("16) TR sayfa: settings null → sözlük (TR) fallback", () => {
    usePathnameMock.mockReturnValue("/tr");
    render(<Footer {...FOOTER_BASE} settings={null} />);
    expect(
      screen.getByText("© 2026 Tatilin Yeri · Tüm hakları saklıdır")
    ).toBeInTheDocument();
  });

  it("17) TR + canonical boş + çeviri VAR → çeviri gösterilir", () => {
    usePathnameMock.mockReturnValue("/tr");
    render(
      <Footer
        {...FOOTER_BASE}
        settings={{ footer_copyright: "", translations: TRANSLATIONS }}
      />
    );
    expect(
      screen.getByText("© 2026 Tatilin Yeri · Tüm hakları saklıdır.")
    ).toBeInTheDocument();
  });
});

/* ===============================================================
   C) EN BİT-BİRE AYNILIK — regresyon kilidi
   =============================================================== */
describe("EN bit-bire aynılık (§6) — çeviri VARKEN bile EN çıktısı değişmez", () => {
  beforeEach(() => usePathnameMock.mockReset());

  it("24) Footer EN DOM'u, translations=null ve translations=DOLU durumlarında AYNI", () => {
    usePathnameMock.mockReturnValue("/");
    const { container: withoutT, unmount } = render(
      <Footer
        {...FOOTER_BASE}
        settings={{ footer_copyright: EN_COPYRIGHT, translations: null }}
      />
    );
    const htmlWithout = withoutT.innerHTML;
    unmount();

    usePathnameMock.mockReturnValue("/");
    const { container: withT } = render(
      <Footer
        {...FOOTER_BASE}
        settings={{ footer_copyright: EN_COPYRIGHT, translations: TRANSLATIONS }}
      />
    );
    expect(withT.innerHTML).toBe(htmlWithout);
  });
});
