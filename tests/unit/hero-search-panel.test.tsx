/* ===============================================================
   HERO ARAMA PANELİ — "Concierge bar" tasarım yenilemesi
   ===============================================================
   Yeni görsel kompozisyonun yanında ARAMA DAVRANIŞININ BİREBİR
   korunduğunu kilitler:
     - TR/EN etiketleri ve varsayılan kişi sayısı (2)
     - Kişi / Bölge / Tip seçimi → aynı query parametreleri
       (`guests`, `bolgeler`, `villa-turleri`) ve slug tercihi
     - Tarih aralığı (react-datepicker, portal hedefi) → `start`/`end`
     - Gelişmiş Arama → `flexible=3` + `ozellikler`
     - Yönlendirme: TR `/tr/arama?...`, EN `/arama?...`
     - Erişilebilirlik: aria-expanded, etiketli alanlar, DOM/tab sırası
   =============================================================== */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const TYPES = [
  { id: "t1", name: "Balayı Villası", slug: "balayi-villasi" },
  { id: "t2", name: "Muhafazakar Villa", slug: null },
];
const LOCATIONS = [
  { id: "r1", name: "Kalkan", slug: "kalkan", filter_group_name: "Kalkan" },
  { id: "r2", name: "Kalkan Merkez", slug: "kalkan-merkez", filter_group_name: "Kalkan" },
  { id: "r3", name: "Kaş", slug: "kas", filter_group_name: "Kaş" },
];
const FEATURES = [
  { id: "f-uuid-1", name: "Isıtmalı havuz" },
  { id: "f-uuid-2", name: "Jakuzi" },
];

const loadHeroFiltersMock = vi.fn();
const loadHeroFeaturesMock = vi.fn();
vi.mock("@/app/components/ui/hero/_components/hero-filters.action", () => ({
  loadHeroFilters: (...a: unknown[]) => loadHeroFiltersMock(...a),
}));
vi.mock("@/app/components/ui/hero/_components/hero-features.action", () => ({
  loadHeroFeatures: (...a: unknown[]) => loadHeroFeaturesMock(...a),
}));

import HeroSearchPanel from "@/app/components/ui/hero/_components/HeroSearchPanel";

function pushedUrl(): string {
  expect(pushMock).toHaveBeenCalledTimes(1);
  return pushMock.mock.calls[0][0] as string;
}

function queryOf(url: string): URLSearchParams {
  return new URLSearchParams(url.split("?")[1] ?? "");
}

async function renderPanel(locale: "tr" | "en" = "tr") {
  const utils = render(<HeroSearchPanel locale={locale} />);
  await waitFor(() => expect(loadHeroFiltersMock).toHaveBeenCalledWith(locale));
  return utils;
}

beforeEach(() => {
  pushMock.mockReset();
  loadHeroFiltersMock.mockReset();
  loadHeroFeaturesMock.mockReset();
  loadHeroFiltersMock.mockResolvedValue({ types: TYPES, locations: LOCATIONS });
  loadHeroFeaturesMock.mockResolvedValue(FEATURES);
});

describe("HeroSearchPanel — yeni tasarım, korunan davranış", () => {
  it("1) TR etiketleri, varsayılan 2 kişi ve 'Villa bul' ana aksiyonu", async () => {
    await renderPanel("tr");
    expect(screen.getByText("Tarih")).toBeTruthy();
    expect(screen.getByText("Kişi")).toBeTruthy();
    expect(screen.getByText("Bölge")).toBeTruthy();
    expect(screen.getByText("Tip")).toBeTruthy();
    expect(screen.getByPlaceholderText("Tarih seç")).toBeTruthy();
    /* Etiketli alanlar — <label> sarmalayıcısı erişilebilir ad verir. */
    const guests = screen.getByLabelText("Kişi") as HTMLSelectElement;
    expect(guests.tagName).toBe("SELECT");
    expect(guests.value).toBe("2");
    expect(guests.options).toHaveLength(10);
    expect(guests.options[0].textContent).toBe("1 kişi");
    expect(screen.getByLabelText("Tarih").tagName).toBe("INPUT");
    expect(screen.getByRole("button", { name: /Villa bul/ })).toBeTruthy();
  });

  it("2) TR varsayılan arama → /arama?guests=2", async () => {
    await renderPanel("tr");
    fireEvent.click(screen.getByRole("button", { name: /Villa bul/ }));
    expect(pushedUrl()).toBe("/tr/arama?guests=2");
  });

  it("3) EN etiketleri + yönlendirme /en/arama", async () => {
    await renderPanel("en");
    expect(screen.getByText("Dates")).toBeTruthy();
    expect(screen.getByText("Guests")).toBeTruthy();
    expect(screen.getByText("Region")).toBeTruthy();
    expect(screen.getByText("Type")).toBeTruthy();
    expect(screen.getByPlaceholderText("Select dates")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Guests"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Find a villa/ }));
    expect(pushedUrl()).toBe("/arama?guests=5");
  });

  it("4) Bölge: yalnız grup kökleri listelenir, seçim → bolgeler=slug", async () => {
    await renderPanel("tr");
    const trigger = screen.getByRole("button", { name: /Bölge/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await screen.findByLabelText("Kalkan");
    expect(screen.queryByLabelText("Kalkan Merkez")).toBeNull();
    fireEvent.click(screen.getByLabelText("Kalkan"));
    fireEvent.click(screen.getByLabelText("Kaş"));
    expect(screen.getByText("2 bölge seçildi")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Villa bul/ }));
    const q = queryOf(pushedUrl());
    expect(q.get("bolgeler")).toBe("kalkan,kas");
    expect(q.get("guests")).toBe("2");
  });

  it("5) Tip: slug tercih edilir, slug yoksa id; açılınca bölge kapanır", async () => {
    await renderPanel("tr");
    fireEvent.click(screen.getByRole("button", { name: /Bölge/ }));
    const typeTrigger = screen.getByRole("button", { name: /Tip/ });
    fireEvent.click(typeTrigger);
    expect(screen.getByRole("button", { name: /Bölge/ }).getAttribute("aria-expanded")).toBe("false");
    expect(typeTrigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(await screen.findByLabelText("Balayı Villası"));
    fireEvent.click(screen.getByLabelText("Muhafazakar Villa"));
    fireEvent.click(screen.getByRole("button", { name: /Villa bul/ }));
    expect(queryOf(pushedUrl()).get("villa-turleri")).toBe("balayi-villasi,t2");
  });

  it("6) Dış tıklama açık dropdown'ı kapatır (mousedown dinleyicisi korunur)", async () => {
    await renderPanel("tr");
    const trigger = screen.getByRole("button", { name: /Bölge/ });
    fireEvent.click(trigger);
    await screen.findByLabelText("Kalkan");
    fireEvent.mouseDown(document.body);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("Kalkan")).toBeNull();
  });

  it("7) Tarih aralığı (portal takvim) → start/end YYYY-MM-DD", async () => {
    await renderPanel("tr");
    fireEvent.click(screen.getByPlaceholderText("Tarih seç"));
    const portal = await waitFor(() => {
      const el = document.getElementById("hero-datepicker-portal");
      expect(el).toBeTruthy();
      expect(el!.querySelector(".react-datepicker")).toBeTruthy();
      return el!;
    });
    fireEvent.click(portal.querySelector(".react-datepicker__navigation--next")!);
    const days = () =>
      Array.from(
        portal.querySelectorAll<HTMLElement>(
          ".react-datepicker__day:not(.react-datepicker__day--outside-month)"
        )
      );
    fireEvent.click(days().find((d) => d.textContent === "10")!);
    fireEvent.click(days().find((d) => d.textContent === "15")!);

    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const ym = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;

    fireEvent.click(screen.getByRole("button", { name: /Villa bul/ }));
    const q = queryOf(pushedUrl());
    expect(q.get("start")).toBe(`${ym}-10`);
    expect(q.get("end")).toBe(`${ym}-15`);
    /* Değer satırı tarih etiketini gösterir (placeholder değil). */
    expect((screen.getByLabelText("Tarih") as HTMLInputElement).value).toMatch(/10.*–.*15/);
  });

  it("8) Gelişmiş Arama → flexible=3 + ozellikler (aria-expanded)", async () => {
    await renderPanel("tr");
    const adv = screen.getByRole("button", { name: /Gelişmiş Arama/ });
    expect(adv.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(adv);
    expect(adv.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(
      screen.getByLabelText("Sonuçlarda 3 gün önceki ve sonraki villaları da göster")
    );
    fireEvent.click(await screen.findByLabelText("Jakuzi"));
    fireEvent.click(screen.getByRole("button", { name: /Villa bul/ }));
    const q = queryOf(pushedUrl());
    expect(q.get("flexible")).toBe("3");
    expect(q.get("ozellikler")).toBe("f-uuid-2");
  });

  it("9) Yeni kompozisyon: tarih → kişi → bölge → tip → ana aksiyon sırası", async () => {
    const { container } = await renderPanel("tr");
    const panel = container.querySelector("[data-hero-search-panel]") as HTMLElement;
    expect(panel).toBeTruthy();
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>("input, select, button")
    ).map((el) => el.getAttribute("placeholder") || el.textContent?.trim().slice(0, 6));
    expect(focusables).toHaveLength(5);
    expect(panel.querySelectorAll("input, select, button")[1].tagName).toBe("SELECT");
    expect(focusables[0]).toBe("Tarih seç");
    expect(focusables[2]).toMatch(/^Bölge/);
    expect(focusables[3]).toMatch(/^Tip/);
    expect(focusables[4]).toMatch(/^Villa/);
    /* Mobil 2 kolon ızgara, masaüstü tek satır bar. */
    expect(panel.className).toMatch(/grid-cols-\[1\.45fr_1fr\]/);
    expect(panel.className).toMatch(/md:flex/);
  });
});
