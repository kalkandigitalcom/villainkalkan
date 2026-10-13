/* ===============================================================
   🛡️ HEADER — sticky (scroll) tema durumları
   ===============================================================
   • Ana sayfa, en üstte      → şeffaf zemin, açık metin, AÇIK logo
                                (footer_logo) görünür
   • Ana sayfa, kaydırılmış   → BEYAZ zemin, petrol (#244C45) metin,
                                KOYU logo (site_logo) görünür
     (ana sayfada iki varyant aynı hücrede; yalnız opaklık değişir)
   • İç sayfa (her durumda)   → petrol zemin, açık metin, footer logosu
   Ağır alt bileşenler shallow mock'lanır (header-locale.test ile aynı).
   =============================================================== */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";

const usePathnameMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/app/components/layout/VillaSearchBox", () => ({ default: () => null }));
vi.mock("@/app/components/favorites/HeaderFavoritesLink", () => ({
  default: () => null,
}));

import Header from "@/app/components/layout/Header";

const MENU = [{ id: "1", name: "Villalar", href: "/kiralik-villalar" }];
const SITE_LOGO = "https://assets.example.com/logo/logo.webp";
const FOOTER_LOGO = "https://assets.example.com/logo/footer-logo.webp";

function setScroll(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

function renderAt(pathname: string) {
  usePathnameMock.mockReturnValue(pathname);
  const utils = render(
    <Header menu={MENU} siteLogo={SITE_LOGO} footerLogo={FOOTER_LOGO} />
  );
  const shell = utils.container.querySelector("header > div") as HTMLElement;
  const nav = utils.container.querySelector("nav") as HTMLElement;
  const logo = utils.container.querySelector("header img") as HTMLImageElement;
  const light = utils.container.querySelector('img[data-logo-variant="light"]') as HTMLImageElement | null;
  const dark = utils.container.querySelector('img[data-logo-variant="dark"]') as HTMLImageElement | null;
  return { ...utils, shell, nav, logo, light, dark };
}

describe("Header — sticky tema", () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
    setScroll(0);
  });
  afterEach(() => setScroll(0));

  it("1) ana sayfa en üstte → şeffaf zemin + açık metin + AÇIK logo görünür", () => {
    const { shell, nav, light, dark } = renderAt("/");
    expect(shell.className).toContain("bg-[#244c45]/10");
    expect(shell.className).not.toContain("bg-white/95");
    expect(nav.className).toContain("text-white/85");
    expect(light!.getAttribute("src")).toBe(FOOTER_LOGO);
    expect(dark!.getAttribute("src")).toBe(SITE_LOGO);
    expect(light!.className).toContain("opacity-100");
    expect(dark!.className).toContain("opacity-0");
    expect(light!.getAttribute("alt")).toBe("Site logosu");
    expect(dark!.getAttribute("aria-hidden")).toBe("true");
  });

  it("2) ana sayfa kaydırılınca → beyaz zemin + petrol metin ", () => {
    const { shell, nav } = renderAt("/");
    setScroll(200);
    expect(shell.className).toContain("bg-white/95");
    expect(shell.className).not.toContain("bg-[var(--color-stone-900)]/95");
    expect(shell.className).toContain("transition-[background-color,box-shadow,border-color]");
    expect(nav.className).toContain("text-[#244C45]/80");
    expect(nav.className).not.toContain("text-white/85");
  });

  it("2b) kaydırınca KOYU logo görünür, açık logo gizlenir (aynı hücre → kayma yok)", () => {
    const { light, dark } = renderAt("/");
    setScroll(200);
    expect(dark!.className).toContain("opacity-100");
    expect(light!.className).toContain("opacity-0");
    expect(dark!.getAttribute("alt")).toBe("Site logosu");
    expect(light!.getAttribute("aria-hidden")).toBe("true");
    for (const img of [light!, dark!]) {
      expect(img.className).toContain("col-start-1");
      expect(img.className).toContain("row-start-1");
      expect(img.className).toContain("md:h-16");
    }
  });

  it("2c) footer_logo yoksa ana sayfada tek logo (site_logo) — kırılmaz", () => {
    usePathnameMock.mockReturnValue("/");
    const { container } = render(<Header menu={MENU} siteLogo={SITE_LOGO} footerLogo={null} />);
    const imgs = container.querySelectorAll("header img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute("src")).toBe(SITE_LOGO);
  });

  it("3) TR/EN/DE ana sayfaları aynı logo + sticky beyaz temayı kullanır", () => {
    for (const p of ["/", "/tr", "/en", "/de"]) {
      const { shell, light, dark, unmount } = renderAt(p);
      expect(light!.className, p).toContain("opacity-100");
      setScroll(200);
      expect(shell.className, p).toContain("bg-white/95");
      expect(dark!.className, p).toContain("opacity-100");
      unmount();
      setScroll(0);
    }
  });

  it("4) iç sayfa (en üstte ve kaydırılmış) → petrol zemin + footer logosu (DEĞİŞMEDİ)", () => {
    const { shell, nav, logo } = renderAt("/kiralik-villalar");
    expect(shell.className).toContain("bg-[var(--color-stone-900)]/95");
    expect(logo.getAttribute("src")).toBe(FOOTER_LOGO);
    setScroll(200);
    expect(shell.className).toContain("bg-[var(--color-stone-900)]/95");
    expect(shell.className).not.toContain("bg-white/95");
    expect(nav.className).toContain("text-white/85");
    expect(logo.getAttribute("src")).toBe(FOOTER_LOGO);
  });

  it("5) kaydırma geri en üste dönünce şeffaf duruma döner", () => {
    const { shell } = renderAt("/");
    setScroll(200);
    expect(shell.className).toContain("bg-white/95");
    setScroll(0);
    expect(shell.className).toContain("bg-[#244c45]/10");
  });

  it("5b) ana sayfa logosu büyük (h-12 / md:h-16), oran korunur — şeffaf ve sticky", () => {
    const { light, dark } = renderAt("/");
    for (const img of [light!, dark!]) {
      for (const c of ["h-12", "md:h-16", "w-auto", "object-contain"]) {
        expect(img.className, c).toContain(c);
      }
    }
    setScroll(200);
    expect(dark!.className).toContain("md:h-16");
  });

  it("5c) iç sayfa logo boyutu DEĞİŞMEDİ (h-9 / md:h-12)", () => {
    const { logo } = renderAt("/kiralik-villalar");
    expect(logo.className).toContain("h-9");
    expect(logo.className).toContain("md:h-12");
    expect(logo.className).not.toContain("md:h-16");
  });

  it("6) hamburger ikonu beyaz zeminde petrol renkte", () => {
    const { getByLabelText } = renderAt("/");
    setScroll(200);
    expect(getByLabelText("Menüyü aç").className).toContain("text-[#244C45]");
  });
});
