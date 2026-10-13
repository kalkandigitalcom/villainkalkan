/* ===============================================================
   🛡️ HEADER — sticky (scroll) tema durumları
   ===============================================================
   • Ana sayfa, en üstte      → şeffaf zemin, açık metin, site logosu
   • Ana sayfa, kaydırılmış   → BEYAZ zemin, petrol (#244C45) metin,
                                site logosu (koyu varyant)
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
  return { ...utils, shell, nav, logo };
}

describe("Header — sticky tema", () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
    setScroll(0);
  });
  afterEach(() => setScroll(0));

  it("1) ana sayfa en üstte → şeffaf zemin + açık metin + site logosu (DEĞİŞMEDİ)", () => {
    const { shell, nav, logo } = renderAt("/");
    expect(shell.className).toContain("bg-[#244c45]/10");
    expect(shell.className).not.toContain("bg-white/95");
    expect(nav.className).toContain("text-white/85");
    expect(logo.getAttribute("src")).toBe(SITE_LOGO);
  });

  it("2) ana sayfa kaydırılınca → beyaz zemin + petrol metin + site logosu", () => {
    const { shell, nav, logo } = renderAt("/");
    setScroll(200);
    expect(shell.className).toContain("bg-white/95");
    expect(shell.className).not.toContain("bg-[var(--color-stone-900)]/95");
    expect(shell.className).toContain("transition-[background-color,box-shadow,border-color]");
    expect(nav.className).toContain("text-[#244C45]/80");
    expect(nav.className).not.toContain("text-white/85");
    expect(logo.getAttribute("src")).toBe(SITE_LOGO);
  });

  it("3) EN/DE ana sayfaları da aynı sticky beyaz temayı kullanır", () => {
    for (const p of ["/en", "/de"]) {
      const { shell, unmount } = renderAt(p);
      setScroll(200);
      expect(shell.className, p).toContain("bg-white/95");
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

  it("6) hamburger ikonu beyaz zeminde petrol renkte", () => {
    const { getByLabelText } = renderAt("/");
    setScroll(200);
    expect(getByLabelText("Menüyü aç").className).toContain("text-[#244C45]");
  });
});
