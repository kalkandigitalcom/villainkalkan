/* ===============================================================
   🛡️ Villa detay üst bölüm — paylaşım şeridi, yapışkan turuncu
   navigasyon şeridi, "Fotoğrafları Göster" ve "Müsaitlik Takvimi"
   popup tetikleyicileri. Bölümler sayfada hep açık; şerit yalnız
   kaydırır ve ekrandaki bölümü aktif gösterir. URL/hash değişmez.
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
import { VILLA_AVAILABILITY_OPEN_EVENT } from "@/app/components/villa/villa-detail-events";
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
        konum={<p>PANEL-KONUM</p>}
        ozellikler={<p>PANEL-OZELLIK</p>}
      />
      <VillaAvailabilityShortcut locale={locale} />
    </>
  );
}

const stripNav = (d = tr) =>
  screen.getByRole("navigation", { name: d.villaTabs.sectionNavAriaLabel });
const navBtn = (name: string) =>
  within(stripNav()).getByRole("button", { name });
const bar = () =>
  document.querySelector("[data-villa-section-nav-bar]") as HTMLElement;

function setRect(el: Element, top: number, height = 0) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    top,
    height,
    bottom: top + height,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);
}

/** Sabit Header (TopBar dahil) — gerçek sayfadaki gibi `position: fixed`. */
function mountHeader(height: number) {
  const header = document.createElement("header");
  header.style.position = "fixed";
  document.body.prepend(header);
  setRect(header, 0, height);
  return header;
}

async function flushScroll() {
  await act(async () => {
    window.dispatchEvent(new Event("scroll"));
    await new Promise((r) => setTimeout(r, 40));
  });
}

let scrollToSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrollToSpy = vi.fn();
  window.scrollTo = scrollToSpy as unknown as typeof window.scrollTo;
  /* Galeri lightbox küçük resim şeridi için (jsdom'da yok). */
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll("body > header").forEach((h) => h.remove());
  document.body.style.overflow = "";
});

describe("İçerik bölümleri sayfada ardışık ve hep açık", () => {
  it("Fiyatlar, Konum, Özellikler aynı anda görünür; sayfada takvim bölümü yok", () => {
    const { container } = render(<Page />);
    for (const p of ["PANEL-FIYAT", "PANEL-KONUM", "PANEL-OZELLIK"]) {
      expect(screen.getByText(p)).toBeInTheDocument();
    }
    const ids = Array.from(
      container.querySelectorAll("[data-villa-section]"),
    ).map((n) => n.id);
    expect(ids).toEqual(["villa-fiyatlar", "villa-konum", "villa-ozellikler"]);
    expect(document.getElementById("villa-musaitlik")).toBeNull();
  });

  it("şerit tıklaması içerikleri gizlemez / değiştirmez", () => {
    render(<Page />);
    fireEvent.click(navBtn(tr.villaTabs.features));
    fireEvent.click(navBtn(tr.villaTabs.location));
    for (const p of ["PANEL-FIYAT", "PANEL-KONUM", "PANEL-OZELLIK"]) {
      expect(screen.getByText(p)).toBeInTheDocument();
    }
  });
});

describe("Üst navigasyon şeridi", () => {
  it("Açıklama, Fiyatlar, Konum, Özellikler; Müsaitlik öğesi yok; tek navigasyon", () => {
    render(<Page />);
    const labels = within(stripNav())
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(labels).toEqual([
      tr.villaTabs.description,
      tr.villaTabs.prices,
      tr.villaTabs.location,
      tr.villaTabs.features,
    ]);
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
  });

  it("turuncu marka rengi (bg-accent), ayrı beyaz kap yok; aktif öğe zemin değil alt çizgi", () => {
    render(<Page />);
    expect(bar().className).toContain("bg-accent");
    expect(bar().className).not.toContain("bg-white");
    expect(bar().querySelector(".bg-white")).toBeNull();
    const active = navBtn(tr.villaTabs.description);
    expect(active.className).toContain("after:bg-ink");
    expect(active.className).not.toMatch(/(^|\s)bg-(brand|ink|white)\b/);
    expect(navBtn(tr.villaTabs.prices).className).toContain(
      "hover:after:bg-ink/35",
    );
  });

  it("sayfanın başında Açıklama aktif", async () => {
    mountHeader(108);
    render(<Page />);
    setRect(bar(), 640, 56);
    setRect(document.getElementById("villa-aciklama")!, 760);
    setRect(document.getElementById("villa-fiyatlar")!, 1200);
    setRect(document.getElementById("villa-konum")!, 2400);
    setRect(document.getElementById("villa-ozellikler")!, 3000);
    await flushScroll();
    expect(navBtn(tr.villaTabs.description)).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it.each([
    ["description", "villa-aciklama"],
    ["prices", "villa-fiyatlar"],
    ["location", "villa-konum"],
    ["features", "villa-ozellikler"],
  ] as const)(
    "%s → ilgili bölüme yumuşak kaydırır (Header + şerit payı), öğe aktif olur",
    (key, anchorId) => {
      mountHeader(108);
      render(<Page />);
      setRect(bar(), 600, 56);
      setRect(document.getElementById(anchorId)!, 1500);
      Object.defineProperty(window, "scrollY", {
        value: 200,
        configurable: true,
      });

      fireEvent.click(navBtn(tr.villaTabs[key]));

      /* 1500 + 200 − (108 Header + 56 şerit + 16) = 1520 */
      expect(scrollToSpy).toHaveBeenCalledWith({
        top: 1520,
        behavior: "smooth",
      });
      expect(navBtn(tr.villaTabs[key])).toHaveAttribute("aria-current", "true");
    },
  );

  it("şeritte popup açan öğe yok; Müsaitlik Takvimi butonu şeridin dışında", () => {
    render(<Page />);
    expect(
      within(stripNav()).queryByRole("button", { name: /Müsaitlik/ }),
    ).toBeNull();
    expect(stripNav().querySelector("[aria-haspopup]")).toBeNull();
    expect(
      screen.getByRole("button", { name: tr.villaHero.availabilityCalendar }),
    ).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("URL/hash değişmez", () => {
    const before = window.location.href;
    render(<Page />);
    fireEvent.click(navBtn(tr.villaTabs.features));
    fireEvent.click(navBtn(tr.villaTabs.description));
    expect(window.location.href).toBe(before);
  });

  it("kullanıcı kendisi kaydırınca ekrandaki bölüm aktif olur", async () => {
    mountHeader(108);
    render(<Page />);
    setRect(bar(), 108, 56);
    setRect(document.getElementById("villa-aciklama")!, -900);
    setRect(document.getElementById("villa-fiyatlar")!, 150);
    setRect(document.getElementById("villa-konum")!, 900);
    setRect(document.getElementById("villa-ozellikler")!, 1400);

    await flushScroll();
    expect(navBtn(tr.villaTabs.prices)).toHaveAttribute("aria-current", "true");

    setRect(document.getElementById("villa-fiyatlar")!, -300);
    setRect(document.getElementById("villa-konum")!, 170);
    await flushScroll();
    expect(navBtn(tr.villaTabs.location)).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(navBtn(tr.villaTabs.prices)).not.toHaveAttribute("aria-current");
  });
});

describe("Yapışkan şerit", () => {
  it("sticky; üst değeri Header'ın ölçülen gerçek yüksekliği", async () => {
    mountHeader(120);
    render(<Page />);
    await flushScroll();
    expect(bar().className).toContain("sticky");
    expect(bar().style.top).toBe("120px");
  });

  it("doğal konumda z-index yok (kart üstüne taşar); yapışınca z-30", async () => {
    mountHeader(108);
    render(<Page />);
    setRect(bar(), 640, 56);
    await flushScroll();
    expect(bar()).not.toHaveAttribute("data-stuck");
    expect(bar().className).not.toMatch(/(^|\s)z-/);

    setRect(bar(), 108, 56);
    await flushScroll();
    expect(bar()).toHaveAttribute("data-stuck", "true");
    expect(bar().className).toContain("z-30");
  });

  it("Header yoksa SSR varsayılanı (108px) korunur", () => {
    render(<Page />);
    expect(bar().style.top).toBe("108px");
  });
});

describe("Rezervasyon kartı kısayolu", () => {
  it("'Müsaitlik Takvimi' kaydırmaz, popup açma olayını yayınlar", () => {
    const onOpen = vi.fn();
    window.addEventListener(VILLA_AVAILABILITY_OPEN_EVENT, onOpen);
    render(<Page />);
    const btn = screen.getByRole("button", {
      name: tr.villaHero.availabilityCalendar,
    });
    expect(btn).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).not.toHaveBeenCalled();
    window.removeEventListener(VILLA_AVAILABILITY_OPEN_EVENT, onOpen);
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
