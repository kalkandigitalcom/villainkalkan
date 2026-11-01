/* ===============================================================
   🛡️ PHASE 10E BATCH 5 — VillaPoolSection TESTLERİ
   ===============================================================
   Hedef: app/components/villa/VillaPoolSection.tsx (EN havuz bölümü).
   GERÇEK dictionary + GERÇEK pool helper'ları kullanılır.
=============================================================== */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import VillaPoolSection from "@/app/components/villa/VillaPoolSection";
import type { PoolCardSource } from "@/lib/pool.helper";

const VILLA: PoolCardSource = {
  pool_type: "ozel",
  pool_sheltered: true,
  pool_width: "4",
  pool_length: "8",
  pool_depth: "1.5",
  indoor_pool: true,
  indoor_pool_width: "3",
  indoor_pool_length: "6",
  indoor_pool_depth: "1.2",
  child_pool: true,
};

describe("VillaPoolSection — locale etiketleri", () => {
  it("EN havuz tipleri ve UI metinleri", () => {
    render(<VillaPoolSection villa={VILLA} locale="en" />);
    expect(screen.getByText("Pool Details")).toBeInTheDocument();
    expect(screen.getByText("Private Sheltered Pool")).toBeInTheDocument();
    expect(screen.getByText("Indoor Pool")).toBeInTheDocument();
    expect(screen.getByText("Children's Pool")).toBeInTheDocument();
    expect(screen.getAllByText("Width").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Depth").length).toBeGreaterThan(0);
  });

  it("TR locale mevcut TR metinlerini verir", () => {
    render(<VillaPoolSection villa={VILLA} locale="tr" />);
    expect(screen.getByText("Havuz Bilgileri")).toBeInTheDocument();
    expect(screen.getByText("Özel Korunaklı Havuz")).toBeInTheDocument();
    expect(screen.getByText("Kapalı Havuz")).toBeInTheDocument();
    expect(screen.getByText("Çocuk Havuzu")).toBeInTheDocument();
  });

  it("ortak havuz → shared etiketi", () => {
    render(
      <VillaPoolSection villa={{ pool_type: "ortak" }} locale="en" />
    );
    expect(screen.getByText("Shared Pool")).toBeInTheDocument();
  });

  it("havuz yoksa HİÇBİR ŞEY render edilmez", () => {
    const { container } = render(
      <VillaPoolSection villa={{ pool_type: "yok" }} locale="en" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("ölçü yoksa locale'e uygun 'ölçü yok' metni", () => {
    render(
      <VillaPoolSection villa={{ pool_type: "ozel" }} locale="en" />
    );
    expect(screen.getByText("No dimension information")).toBeInTheDocument();
  });

  it("ölçüler formatPoolDimension ile 'm' ekli, locale'den bağımsız", () => {
    const { unmount } = render(
      <VillaPoolSection
        villa={{ pool_type: "ozel", pool_width: "4", pool_length: "8" }}
        locale="en"
      />
    );
    expect(screen.getByText("4 m")).toBeInTheDocument();
    unmount();

    render(
      <VillaPoolSection
        villa={{ pool_type: "ozel", pool_width: "4", pool_length: "8" }}
        locale="tr"
      />
    );
    /* Ölçü DEĞERİ çevrilmez. */
    expect(screen.getByText("4 m")).toBeInTheDocument();
  });

  /* 2026-10 düzeni: her havuz kartında tipten (canonical anahtar)
     seçilen 1 ikon + ölçü satırı başına 1 ikon. İkon sayısı locale'den
     bağımsız. */
  it("🛡️ ikon sayısı locale'den ve etiketten ETKİLENMEZ", () => {
    const { container: en } = render(
      <VillaPoolSection villa={VILLA} locale="en" />
    );
    const enSvg = en.querySelectorAll("svg").length;
    const { container: tr } = render(
      <VillaPoolSection villa={VILLA} locale="tr" />
    );
    expect(tr.querySelectorAll("svg").length).toBe(enSvg);
    /* 3 havuz tipi ikonu + ana (3 ölçü) + kapalı (3 ölçü); çocuk ölçüsüz */
    expect(enSvg).toBe(3 + 3 + 3);
  });

  it("🛡️ kart sırası ve sayısı locale'den bağımsız (ana → kapalı → çocuk)", () => {
    const { container: en } = render(
      <VillaPoolSection villa={VILLA} locale="en" />
    );
    const { container: tr } = render(
      <VillaPoolSection villa={VILLA} locale="tr" />
    );
    const order = (c: HTMLElement) =>
      Array.from(c.querySelectorAll("[data-pool-card]")).map((el) =>
        el.getAttribute("data-pool-card")
      );
    expect(order(en)).toEqual(["main", "indoor", "child"]);
    expect(order(tr)).toEqual(order(en));
  });

  it("beyaz ana kart; havuz kutuları ince çerçeveli beyaz, 2 sütunlu grid; renkli zemin/gradient yok", () => {
    const { container } = render(
      <VillaPoolSection villa={VILLA} locale="en" />
    );
    const section = container.querySelector("section")!;
    expect(section.className).toMatch(/(^|\s)bg-white(\s|$)/);
    expect(container.querySelector(".grid.grid-cols-1.sm\\:grid-cols-2")).toBeTruthy();
    const cards = container.querySelectorAll("[data-pool-card]");
    cards.forEach((card) => {
      expect(card.className).toContain("border");
      expect(card.className).toMatch(/(^|\s)bg-white(\s|$)/);
    });
    expect(container.innerHTML).not.toMatch(/bg-gradient|sand-100|shadow-/);
    /* Ölçü etiketleri + değerler tanım listesi olarak. */
    expect(container.querySelectorAll("dl")).toHaveLength(2);
    expect(container.querySelectorAll("dt")).toHaveLength(6);
  });
});
