/* ===============================================================
   🛡️ HEADER — tüm public sayfalarda TEK görünüm
   ===============================================================
   • Her sayfada (ana sayfa dahil), kaydırmadan bağımsız: BEYAZ zemin,
     koyu metin (#1B2E5E, text-ink) yazı/ikon, KOYU logo (site_logo).
   • Logo boyutu her sayfada aynı: h-12 (mobil) / md:h-16 (masaüstü),
     oran korunur (w-auto + object-contain).
   • footer_logo header'da KULLANILMAZ (Footer'a özgü).
   • Spacer yalnız iç sayfalarda (hero header altından başlar).
   Ağır alt bileşenler shallow mock'lanır (header-locale.test ile aynı).
   =============================================================== */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { readFileSync } from "fs";

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
const PATHS = ["/", "/tr", "/kiralik-villalar", "/tr/kiralik-villalar", "/tr/kiralik-villa/x", "/tr/arama", "/tr/blog", "/blog"];

function setScroll(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

function renderAt(pathname: string, siteLogo: string | null = SITE_LOGO) {
  usePathnameMock.mockReturnValue(pathname);
  const utils = render(<Header menu={MENU} siteLogo={siteLogo} />);
  const shell = utils.container.querySelector("header > div") as HTMLElement;
  const nav = utils.container.querySelector("nav") as HTMLElement;
  const imgs = utils.container.querySelectorAll("header img");
  return { ...utils, shell, nav, imgs };
}

describe("Header — standart beyaz görünüm", () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
    setScroll(0);
  });
  afterEach(() => setScroll(0));

  it.each(PATHS)("1) %s → beyaz zemin + petrol metin, kaydırınca zemin DEĞİŞMEZ", (p) => {
    const { shell, nav } = renderAt(p);
    const before = shell.className.split(" ").filter((c) => c.startsWith("bg-"));
    expect(before).toEqual(["bg-white"]);
    expect(nav.className).toContain("text-ink/80");
    expect(nav.className).not.toContain("text-white");
    setScroll(200);
    const after = shell.className.split(" ").filter((c) => c.startsWith("bg-"));
    expect(after).toEqual(before);
    expect(nav.className).toContain("text-ink/80");
  });

  it.each(PATHS)("2) %s → tek KOYU logo (site_logo), aynı boyut sınıfları", (p) => {
    const { imgs } = renderAt(p);
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute("src")).toBe(SITE_LOGO);
    expect(imgs[0].getAttribute("alt")).toMatch(p === "/tr" || p.startsWith("/tr/") ? /^Site logosu$/ : /^Site logo$/);
    for (const c of ["h-12", "md:h-16", "w-auto", "object-contain"]) {
      expect(imgs[0].className, c).toContain(c);
    }
    expect(imgs[0].className).not.toContain("h-9");
  });

  it("3) logo boyutu sayfadan bağımsız — ana sayfa ile iç sayfa birebir", () => {
    const home = renderAt("/").imgs[0].className;
    cleanupAll();
    const inner = renderAt("/tr/kiralik-villalar").imgs[0].className;
    expect(inner).toBe(home);
  });

  it("4) site_logo yoksa wordmark (beyaz zeminde görünmeyen footer logosu KULLANILMAZ)", () => {
    const { imgs, container } = renderAt("/", null);
    expect(imgs).toHaveLength(0);
    expect(container.querySelector("header a")!.textContent).toContain("Villa");
  });

  it("5) kaydırınca yalnız ince gölge belirir", () => {
    const { shell } = renderAt("/");
    expect(shell.className).toContain("shadow-none");
    setScroll(200);
    expect(shell.className).toContain("shadow-[0_10px_30px_-16px_rgba(27,46,94,0.28)]");
  });

  it("6) hamburger ikonu beyaz zeminde petrol renkte (her sayfada)", () => {
    for (const p of ["/tr", "/tr/kiralik-villalar"]) {
      const { getByLabelText, unmount } = renderAt(p);
      expect(getByLabelText("Menüyü aç").className).toContain("text-ink");
      unmount();
    }
  });

  it("7) spacer yalnız iç sayfalarda (ana sayfada hero header altından başlar)", () => {
    expect(renderAt("/").container.querySelector("div.h-\\[108px\\]")).toBeNull();
    cleanupAll();
    expect(renderAt("/tr/kiralik-villalar").container.querySelector("div.h-\\[108px\\]")).toBeTruthy();
  });

  it("8) 🔒 kaynak: footer_logo header'a geçirilmiyor, şeffaf durum yok", () => {
    const header = readFileSync("app/components/layout/Header.tsx", "utf-8");
    const wrapper = readFileSync("app/components/layout/HeaderWrapper.tsx", "utf-8");
    expect(header).not.toMatch(/footerLogo/);
    expect(wrapper).not.toMatch(/footerLogo/);
    expect(header).not.toMatch(/overHero|lightSticky|bg-\[#244c45\]\/10/);
  });
});

function cleanupAll() {
  document.body.innerHTML = "";
}
