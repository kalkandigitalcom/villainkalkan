/* ===============================================================
   🛡️ Villa detay üst bölüm — paylaşım şeridi, üst navigasyon şeridi,
   "Fotoğrafları Göster" ve kart "Müsaitlik Takvimi" kısayolu.
   Şerit, sayfadaki TEK sekme navigasyonudur; tetikleyicilerin MEVCUT
   sekme paneli / galeri state'ine ulaştığı doğrulanır.
   =============================================================== */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";

import VillaDetailTabs from "@/app/components/villa/VillaDetailTabs";
import VillaSectionNav from "@/app/components/villa/VillaSectionNav";
import VillaShareLinks from "@/app/components/villa/VillaShareLinks";
import Gallery from "@/app/components/villa/Gallery";
import {
  VillaAvailabilityShortcut,
  VillaShowPhotosButton,
} from "@/app/components/villa/VillaDetailActions";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const tr = getDictionary("tr");
const en = getDictionary("en");

function Page({ locale = "tr" as "tr" | "en" }) {
  return (
    <>
      <VillaSectionNav locale={locale} />
      <section id="villa-aciklama">desc</section>
      <VillaDetailTabs
        fiyatlar={<p>PANEL-FIYAT</p>}
        musaitlik={<p>PANEL-MUSAIT</p>}
        konum={<p>PANEL-KONUM</p>}
        ozellikler={<p>PANEL-OZELLIK</p>}
      />
      <VillaAvailabilityShortcut locale={locale} />
    </>
  );
}

const stripNav = (d = tr) =>
  screen.getByRole("navigation", { name: d.villaTabs.sectionNavAriaLabel });

let scrollSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrollSpy = vi.fn();
  Element.prototype.scrollIntoView =
    scrollSpy as unknown as Element["scrollIntoView"];
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.style.overflow = "";
});

describe("Üst navigasyon şeridi ↔ mevcut sekmeler", () => {
  it("şerit Açıklama + 4 mevcut sekmeyi listeler; yeni bölüm (Mesafeler/Yorumlar) eklemez", () => {
    render(<Page />);
    const labels = within(stripNav())
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(labels).toEqual([
      tr.villaTabs.description,
      tr.villaTabs.prices,
      tr.villaTabs.availability,
      tr.villaTabs.location,
      tr.villaTabs.features,
    ]);
  });

  it("başlangıçta Açıklama aktif, sekme paneli varsayılanı Fiyatlar (değişmedi)", () => {
    render(<Page />);
    expect(
      within(stripNav()).getByRole("button", {
        name: tr.villaTabs.description,
      }),
    ).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("PANEL-FIYAT")).toBeInTheDocument();
  });

  it.each([
    ["availability", "PANEL-MUSAIT"],
    ["location", "PANEL-KONUM"],
    ["features", "PANEL-OZELLIK"],
    ["prices", "PANEL-FIYAT"],
  ] as const)(
    "şeritte %s → ilgili sekme açılır ve sekme bandına kaydırılır",
    (key, panel) => {
      render(<Page />);
      fireEvent.click(
        within(stripNav()).getByRole("button", { name: tr.villaTabs[key] }),
      );
      expect(screen.getByText(panel)).toBeInTheDocument();
      expect(scrollSpy).toHaveBeenCalled();
      expect(
        within(stripNav()).getByRole("button", { name: tr.villaTabs[key] }),
      ).toHaveAttribute("aria-current", "true");
    },
  );

  it("Açıklama → açıklama bölümüne kaydırır, sekme değişmez", () => {
    render(<Page />);
    fireEvent.click(
      within(stripNav()).getByRole("button", {
        name: tr.villaTabs.availability,
      }),
    );
    scrollSpy.mockClear();
    fireEvent.click(
      within(stripNav()).getByRole("button", {
        name: tr.villaTabs.description,
      }),
    );
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy.mock.contexts[0]).toBe(
      document.getElementById("villa-aciklama"),
    );
    expect(screen.getByText("PANEL-MUSAIT")).toBeInTheDocument();
  });

  it("eski sekme bandı yok: sayfadaki tek sekme navigasyonu üst şerit", () => {
    render(<Page />);
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: tr.villaTabs.location }),
    ).toHaveLength(1);
    /* Sekme içerikleri silinmedi: varsayılan panel görünür. */
    expect(screen.getByText("PANEL-FIYAT")).toBeInTheDocument();
  });

  it("kart kısayolu sekmeyi açınca şerit vurgusu senkron kalır", () => {
    render(<Page />);
    fireEvent.click(
      screen.getByRole("button", { name: tr.villaHero.availabilityCalendar }),
    );
    expect(
      within(stripNav()).getByRole("button", {
        name: tr.villaTabs.availability,
      }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("URL/hash değişmez", () => {
    const before = window.location.href;
    render(<Page />);
    fireEvent.click(
      within(stripNav()).getByRole("button", { name: tr.villaTabs.features }),
    );
    fireEvent.click(
      within(stripNav()).getByRole("button", {
        name: tr.villaTabs.description,
      }),
    );
    expect(window.location.href).toBe(before);
  });

  it("kart kısayolu 'Müsaitlik Takvimi' → Müsaitlik sekmesi açılır", () => {
    render(<Page />);
    fireEvent.click(
      screen.getByRole("button", { name: tr.villaHero.availabilityCalendar }),
    );
    expect(screen.getByText("PANEL-MUSAIT")).toBeInTheDocument();
    expect(scrollSpy).toHaveBeenCalled();
  });

  it("EN etiketleri", () => {
    render(<Page locale="en" />);
    expect(
      within(stripNav(en)).getByRole("button", { name: "Description" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Availability Calendar" }),
    ).toBeInTheDocument();
  });
});

describe("Fotoğrafları Göster → mevcut galeri lightbox'ı", () => {
  const images = ["/a.jpg", "/b.jpg", "/c.jpg", "/d.jpg"];

  it("single düzen yalnız ana fotoğrafı gösterir; buton lightbox'ı açar", () => {
    const { container } = render(
      <>
        <VillaShowPhotosButton count={images.length} locale="tr" />
        <Gallery
          layout="single"
          images={images}
          villaTitle="Villa Test"
          locale="tr"
        />
      </>,
    );
    expect(container.querySelector("[data-gallery-single]")).not.toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(1);
    const btn = screen.getByRole("button", { name: "Fotoğrafları Göster (4)" });
    act(() => {
      fireEvent.click(btn);
    });
    expect(document.body.style.overflow).toBe("hidden");
    expect(container.querySelector(".fixed.inset-0")).not.toBeNull();
  });

  it("varsayılan grid düzeni değişmedi (kolaj + Tüm Fotoğraflar)", () => {
    const { container } = render(
      <Gallery images={images} villaTitle="Villa Test" />,
    );
    expect(container.querySelector("[data-gallery-single]")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Tüm fotoğrafları gör (4 fotoğraf)" }),
    ).toBeInTheDocument();
  });

  it("fotoğraf yoksa buton render edilmez", () => {
    const { container } = render(<VillaShowPhotosButton count={0} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("Paylaşım şeridi", () => {
  it("WhatsApp / Facebook / X sayfa adresiyle yeni sekmede açılır", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<VillaShareLinks title="Villa Test" locale="tr" />);
    const href = encodeURIComponent(window.location.href);

    fireEvent.click(
      screen.getByRole("button", { name: tr.villaShare.whatsapp }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: tr.villaShare.facebook }),
    );
    fireEvent.click(screen.getByRole("button", { name: tr.villaShare.x }));

    expect(open.mock.calls[0][0]).toContain("https://wa.me/?text=");
    expect(open.mock.calls[1][0]).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${href}`,
    );
    expect(open.mock.calls[2][0]).toContain(
      `https://twitter.com/intent/tweet?url=${href}`,
    );
    for (const call of open.mock.calls) {
      expect(call[1]).toBe("_blank");
      expect(call[2]).toContain("noopener");
    }
  });

  it("bağlantıyı kopyala → panoya sayfa adresi yazılır, geri bildirim gösterilir", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<VillaShareLinks title="Villa Test" locale="tr" />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: tr.villaShare.copyLink }),
      );
    });
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(
      screen.getByRole("button", { name: tr.villaShare.copied }),
    ).toBeInTheDocument();
  });

  it("EN etiketleri", () => {
    render(<VillaShareLinks title="Villa Test" locale="en" />);
    expect(screen.getByText("Share")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy link" }),
    ).toBeInTheDocument();
  });
});
