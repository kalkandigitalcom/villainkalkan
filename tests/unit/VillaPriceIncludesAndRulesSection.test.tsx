/* ===============================================================
   2026-10 — Konaklama Ücretine Dahil Olanlar + Konaklama Kuralları
   ===============================================================
   Tek beyaz kart; dahil olanlar 2 sütunlu onay listesi, kurallar
   hemen altında ince çerçeveli satırlar. Veri AYNEN; içerik uydurulmaz
   (veri modelinde "dahil olmayan" alanı yok → çarpı listesi yok).
=============================================================== */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

import VillaPriceIncludesAndRulesSection from "@/app/components/villa/VillaPriceIncludesAndRulesSection";

const INCLUDES = [
  { id: "i1", displayTitle: "Elektrik & Su & Gaz Giderleri" },
  { id: "i2", displayTitle: "Günlük Havuz Temizliği" },
  { id: "i3", displayTitle: "Ücretsiz WiFi" },
];
const RULES = [
  { id: "r1", displayTitle: "Evcil hayvan kabul edilmez" },
  { id: "r2", displayTitle: "Sigara içilmez" },
];

describe("VillaPriceIncludesAndRulesSection — 2026-10 düzeni", () => {
  it("TR başlıklar + tüm öğeler aynen; kurallar dahil olanların altında", () => {
    render(<VillaPriceIncludesAndRulesSection priceIncludes={INCLUDES} rules={RULES} locale="tr" />);
    const [incH, rulesH] = screen.getAllByRole("heading", { level: 2 });
    expect(incH).toHaveTextContent("Konaklama Ücretine Dahil Olanlar");
    expect(rulesH).toHaveTextContent("Konaklama Kuralları");
    expect(incH.compareDocumentPosition(rulesH) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const t of [...INCLUDES, ...RULES]) {
      expect(screen.getByText(t.displayTitle)).toBeInTheDocument();
    }
  });

  it("EN başlıklar", () => {
    render(<VillaPriceIncludesAndRulesSection priceIncludes={INCLUDES} rules={RULES} locale="en" />);
    expect(screen.getByRole("heading", { name: "Included in the Price" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "House Rules" })).toBeInTheDocument();
  });

  it("tek beyaz kart; dahil olanlar 2 sütunlu liste; renkli zemin/gradient/gölge yok", () => {
    const { container } = render(
      <VillaPriceIncludesAndRulesSection priceIncludes={INCLUDES} rules={RULES} locale="tr" />
    );
    const card = container.firstElementChild as HTMLElement;
    /* 2026-11 — ortak public kart sistemi. */
    expect(card.className).toMatch(/(^|\s)pub-card(\s|$)/);
    expect(container.querySelectorAll("section")).toHaveLength(2);
    const [incList, rulesList] = screen.getAllByRole("list");
    expect(incList.className).toContain("sm:grid-cols-2");
    expect(within(incList).getAllByRole("listitem")).toHaveLength(3);
    expect(within(rulesList).getAllByRole("listitem")).toHaveLength(2);
    expect(container.innerHTML).not.toMatch(/emerald|rose-|bg-gradient|shadow-/);
  });

  it("yalnız kurallar varsa yalnız kurallar bölümü (ayraçsız); ikisi de boşsa hiçbir şey", () => {
    const { container, unmount } = render(
      <VillaPriceIncludesAndRulesSection priceIncludes={[]} rules={RULES} locale="tr" />
    );
    expect(container.querySelectorAll("section")).toHaveLength(1);
    expect(container.querySelector("section")!.className).not.toContain("border-t");
    unmount();
    const { container: empty } = render(
      <VillaPriceIncludesAndRulesSection priceIncludes={[]} rules={[]} locale="tr" />
    );
    expect(empty).toBeEmptyDOMElement();
  });
});
