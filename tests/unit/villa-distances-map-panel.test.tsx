/* ===============================================================
   2026-10 — Yakındaki Noktalar referans düzeni
   ===============================================================
   VillaDistancesSection: sol liste (ad + mesafe, veri AYNEN — "0"
   dahil), sağ panel slot'u. VillaMapModal variant="panel": iki
   aksiyon, yol tarifi URL'i ve modal davranışı "buttons" varyantıyla
   AYNI.
=============================================================== */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

import VillaDistancesSection, {
  type TranslatedDistance,
} from "@/app/components/villa/VillaDistancesSection";
import VillaMapModal from "@/app/components/villa/VillaMapModal";

const DISTANCES: TranslatedDistance[] = [
  { id: "d1", displayTitle: "Mini Market", displayDistance: "2km", iconKey: "store" },
  { id: "d2", displayTitle: "Otobüs Durakları", displayDistance: "0", iconKey: "bus" },
  { id: "d3", displayTitle: "Dalaman Havaalanı", displayDistance: "135km", iconKey: "plane" },
];

describe("VillaDistancesSection — referans düzeni", () => {
  it("nokta adları ve mesafeleri AYNEN gösterilir ('0' değeri uydurulmadan)", () => {
    render(<VillaDistancesSection distances={DISTANCES} locale="tr" />);
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Mini Market")).toBeInTheDocument();
    expect(screen.getByText("2km")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("135km")).toBeInTheDocument();
    expect(list.className).toContain("sm:grid-cols-2");
  });

  it("mapPanel verilince sağ panel render edilir; liste %60 (3/5) sütun alır", () => {
    const { container } = render(
      <VillaDistancesSection
        distances={DISTANCES}
        locale="tr"
        mapPanel={<div data-testid="panel">panel</div>}
      />
    );
    expect(screen.getByTestId("panel")).toBeInTheDocument();
    expect(container.querySelector(".md\\:col-span-3")).toBeTruthy();
    expect(container.querySelector(".md\\:col-span-2")).toBeTruthy();
  });

  it("görünür başlık bloğu yok; bölüm adı aria-label'da (TR/EN)", () => {
    const { unmount } = render(<VillaDistancesSection distances={DISTANCES} locale="tr" />);
    expect(screen.queryByText("ÇEVREYİ KEŞFEDİN")).not.toBeInTheDocument();
    expect(screen.queryByText("Yakındaki Noktalar")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Yakındaki Noktalar" })).toBeInTheDocument();
    unmount();
    render(<VillaDistancesSection distances={DISTANCES} locale="en" />);
    expect(screen.getByRole("region", { name: "Nearby Places" })).toBeInTheDocument();
  });

  it("boş liste → mevcut boş-durum metni", () => {
    render(<VillaDistancesSection distances={[]} locale="tr" />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

describe("VillaMapModal variant='panel'", () => {
  it("TR: 'Haritada Göster' + 'Yol Tarifi Al'; yol tarifi URL'i aynı", () => {
    render(
      <VillaMapModal variant="panel" mapType="coords" latitude={36.2} longitude={29.4} locale="tr" />
    );
    expect(screen.getByRole("button", { name: "Haritada Göster" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Yol Tarifi Al" });
    expect(link).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=36.2,29.4"
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("EN etiketleri", () => {
    render(
      <VillaMapModal variant="panel" mapType="coords" latitude={36.2} longitude={29.4} locale="en" />
    );
    expect(screen.getByRole("button", { name: "Show on Map" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get Directions" })).toBeInTheDocument();
  });

  it("'Haritada Göster' tıklanınca mevcut harita modalı açılır", () => {
    render(
      <VillaMapModal variant="panel" mapType="coords" latitude={36.2} longitude={29.4} villaTitle="Villa X" locale="tr" />
    );
    fireEvent.click(screen.getByRole("button", { name: "Haritada Göster" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("koordinat yoksa yol tarifi linki yok (devre dışı alan)", () => {
    render(<VillaMapModal variant="panel" locale="tr" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Yol Tarifi Al").closest("[aria-disabled='true']")).toBeTruthy();
  });

  it("varsayılan varyant (sidebar butonları) DEĞİŞMEDİ", () => {
    render(<VillaMapModal mapType="coords" latitude={1} longitude={2} locale="tr" />);
    expect(screen.getByRole("button", { name: "Harita" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Yol Tarifi" })).toBeInTheDocument();
  });
});
