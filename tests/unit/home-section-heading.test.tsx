/* ===============================================================
   ✨ Ana sayfa bölüm başlıkları — ortak başlık + altın süs
   =============================================================== */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import HomeSectionHeading, {
  HomeSectionOrnament,
  HOME_SECTION_TITLE_CLASS,
} from "@/app/components/home/HomeSectionHeading";
import FaqSection from "@/app/components/ui/FaqSection";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("HomeSectionHeading", () => {
  it("h2 başlık, altında dekoratif altın süs, ardından alt metin", () => {
    const { container } = render(
      <HomeSectionHeading title="Öne Çıkan Villalar" subtitle="Alt metin" />,
    );
    const h2 = screen.getByRole("heading", { level: 2, name: "Öne Çıkan Villalar" });
    expect(h2.className).toBe(HOME_SECTION_TITLE_CLASS);
    expect(h2.className).toContain("font-semibold");

    const orn = container.querySelector("[data-home-heading-ornament]") as HTMLElement;
    expect(orn).toHaveAttribute("aria-hidden", "true");
    expect(orn.textContent).toBe("");
    expect(h2.nextElementSibling).toBe(orn);
    expect(orn.nextElementSibling?.textContent).toBe("Alt metin");
  });

  it("süs marka altını kullanır, sabit kısa genişlikte ve ortalı", () => {
    const { container } = render(<HomeSectionOrnament />);
    const orn = container.firstElementChild as HTMLElement;
    expect(orn.className).toContain("justify-center");
    const parts = Array.from(orn.children).map((c) => c.className);
    expect(parts).toHaveLength(3);
    expect(parts.every((c) => /(^|\s)(bg-brand|to-brand)(\s|$)/.test(c))).toBe(true);
    /* Responsive: mobilde w-8, md+ w-12 — genişlik metne bağlı değil. */
    expect(parts[0]).toMatch(/\bw-8\b.*\bmd:w-12\b/);
    expect(parts[1]).toContain("rotate-45");
  });

  it("start hizalamada tek çizgi + elmas, sola yaslı", () => {
    const { container } = render(<HomeSectionOrnament align="start" />);
    const orn = container.firstElementChild as HTMLElement;
    expect(orn).toHaveAttribute("data-home-heading-ornament", "start");
    expect(orn.className).toContain("justify-start");
    expect(orn.children).toHaveLength(2);
  });

  it("alt metin yoksa paragraf basılmaz", () => {
    const { container } = render(<HomeSectionHeading title="X" />);
    expect(container.querySelector("p")).toBeNull();
  });
});

describe("Ana sayfa bölümleri ortak başlığı kullanır", () => {
  it.each([
    "app/components/villa/VillaList.tsx",
    "app/components/home/DiscountCollection.tsx",
    "app/components/villa/LocationCollection.tsx",
    "app/components/home/ShortGapsSection.tsx",
  ])("%s → <HomeSectionHeading>", (p) => {
    const s = src(p);
    expect(s).toContain("<HomeSectionHeading");
    /* Eski sade başlık sınıfı kaldı mı? */
    expect(s).not.toContain("font-medium text-[22px] md:text-[26px]");
  });

  it.each([
    "app/components/home/HomepageReviewsSection.tsx",
    "app/components/ui/FaqSection.tsx",
  ])("%s → başlığın hemen altında sola yaslı süs", (p) => {
    expect(src(p)).toMatch(/<\/h2>\s*<HomeSectionOrnament align="start" \/>/);
  });

  it("SSS bölümü render: süs başlıkla açıklama arasında", () => {
    const tr = getDictionary("tr");
    render(
      <FaqSection faqs={[{ id: "1", question: "S?", answer: "C." }] as never} locale="tr" />,
    );
    const h2 = screen.getByRole("heading", { level: 2, name: tr.home.faq.title });
    const orn = h2.nextElementSibling as HTMLElement;
    expect(orn).toHaveAttribute("data-home-heading-ornament", "start");
    expect(orn.nextElementSibling?.textContent).toBe(tr.home.faq.subtitle);
  });

  it("süs yalnız ana sayfa bileşenlerinde (admin kullanmaz)", () => {
    const users = (readdirSync(join(process.cwd(), "app"), {
      recursive: true,
    }) as string[])
      .filter((p) => /\.tsx?$/.test(p))
      .filter((p) => src(join("app", p)).includes("HomeSectionHeading"));
    expect(users.length).toBeGreaterThan(0);
    const out = users.join("\n");
    expect(out).not.toMatch(/\(admin\)|components\/admin/);
  });
});

describe("Bölgeler ve Kısa Süreli bölümlerinin zemini", () => {
  it("Villa Kiralama Bölgeleri: beyaz zemin tam genişlik section'da, alt açıklama yok", () => {
    const s = src("app/components/villa/LocationCollection.tsx");
    /* Beyaz zemin section'ın kendisinde; iç kap yalnız 1210px içerik çizgisi. */
    expect(s).toMatch(
      /<section[^>]*data-home-section="regions"\s*className=\{`\$\{HOME_PANEL_SECTION_CLASS\} bg-white`\}/,
    );
    expect(s).toContain('<div className="max-w-site mx-auto">');
    expect(s).not.toContain("HOME_PANEL_CLASS");
    expect(s).not.toContain('data-home-panel="regions"');
    expect(s).toContain("<HomeSectionHeading title={dict.title} />");
    expect(s).not.toMatch(/subtitle=|dict\.subtitle/);
    /* Kartlar ve carousel panelin içinde, başlığın altında. */
    const panel = s.slice(s.indexOf('data-home-section="regions"'));
    expect(panel.indexOf("<HorizontalCarousel")).toBeGreaterThan(
      panel.indexOf("<HomeSectionHeading"),
    );
  });

  it("Kısa Süreli bölümü kendi renkli zeminini taşımaz (sayfa zemini görünür)", () => {
    const s = src("app/components/home/ShortGapsSection.tsx");
    const cls = s.match(/id="kisa-sureli-firsatlar"\s*className="([^"]*)"/)?.[1] ?? "";
    expect(cls).toContain("px-5 md:px-10 lg:px-16");
    expect(cls).not.toMatch(/(^|\s)(bg-|from-|to-)/);
    expect(s).not.toContain("#e8eef6");
    expect(s).toContain("<HomeSectionHeading title={dict.title} subtitle={dict.subtitle} />");
  });
});
