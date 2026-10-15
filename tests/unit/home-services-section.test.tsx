/* ===============================================================
   🤝 Ana sayfa — Hizmetlerimiz (üçlü hizmet kartı)
   =============================================================== */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import HomeServicesSection from "@/app/components/home/HomeServicesSection";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const tr = getDictionary("tr").home.services;
const en = getDictionary("en").home.services;

describe("HomeServicesSection", () => {
  it("ortak başlık + üç kart: Villa Kiralama, Villa Satış, Yönetim & Danışmanlık", () => {
    render(<HomeServicesSection locale="tr" />);
    expect(screen.getByRole("heading", { level: 2, name: tr.title })).toBeInTheDocument();
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(["Villa Kiralama", "Villa Satış", "Yönetim & Danışmanlık"]);
    expect(screen.getByRole("region", { name: tr.sectionAriaLabel })).toBeInTheDocument();
  });

  it("bağlantılar yalnız mevcut sayfalara: kiralama → /kiralik-villalar, diğerleri → /iletisim", () => {
    const { container } = render(<HomeServicesSection locale="tr" />);
    const href = (k: string) =>
      container.querySelector(`[data-service-card="${k}"] a`)?.getAttribute("href");
    expect(href("rental")).toBe("/kiralik-villalar");
    expect(href("sale")).toBe("/iletisim");
    expect(href("management")).toBe("/iletisim");
    const rental = container.querySelector('[data-service-card="rental"]') as HTMLElement;
    expect(within(rental).getByRole("link").textContent).toContain(tr.rentalCta);
  });

  it("EN: başlıklar, metinler ve /en önekli bağlantılar", () => {
    const { container } = render(<HomeServicesSection locale="en" />);
    expect(screen.getByRole("heading", { level: 2, name: en.title })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Villa Rental",
      "Villa Sales",
      "Management & Consultancy",
    ]);
    const links = Array.from(container.querySelectorAll("[data-service-card] a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(links).toEqual(["/en/kiralik-villalar", "/en/iletisim", "/en/iletisim"]);
  });

  it("responsive ızgara: mobil tek sütun, tablet iki, masaüstü üç sütun", () => {
    const { container } = render(<HomeServicesSection locale="tr" />);
    const grid = container.querySelector("ul")!.className;
    expect(grid).toContain("grid-cols-1");
    expect(grid).toContain("sm:grid-cols-2");
    expect(grid).toContain("lg:grid-cols-3");
    /* Tablette 3. kart tam satır; masaüstünde normal. */
    expect(grid).toContain("sm:[&>li:last-child]:col-span-2");
    expect(grid).toContain("lg:[&>li:last-child]:col-span-1");
  });

  it("kart görünümü: beyaz, ince kenarlık, hafif gölge; ikon krem dairede ve dekoratif", () => {
    const { container } = render(<HomeServicesSection locale="tr" />);
    const cards = container.querySelectorAll("[data-service-card]");
    expect(cards).toHaveLength(3);
    for (const card of Array.from(cards)) {
      const c = card.className;
      expect(c).toContain("bg-white");
      expect(c).toContain("border");
      expect(c).toMatch(/rounded-\[22px\]/);
      expect(c).toContain("motion-reduce:transition-none");
      const icon = card.querySelector("[data-service-icon]") as HTMLElement;
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(icon.className).toContain("bg-[#FFFAF1]");
      expect(icon.querySelector("svg")).not.toBeNull();
    }
  });
});

describe("Ana sayfa sırası", () => {
  it("Öne Çıkan Villalar → Hizmetlerimiz → İndirimli Kiralık Villalar", () => {
    const body = readFileSync(
      join(process.cwd(), "app/components/home/HomePageBody.tsx"),
      "utf8",
    );
    const at = (t: string) => body.indexOf(t);
    expect(at("<HomeServicesSection")).toBeGreaterThan(at("<VillaList"));
    expect(at("<DiscountCollection")).toBeGreaterThan(at("<HomeServicesSection"));
  });
});
