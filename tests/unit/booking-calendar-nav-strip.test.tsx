/* ===============================================================
   🛡️ BookingCalendar — DIŞ NAV STRIP KALDIRILDI (UI-only)
   ===============================================================
   Önceki tasarımda takvimin ÜSTÜNDE ayrı bir "[Ay Yıl … Bugün]"
   şeridi vardı ve DayPicker'ın kendi caption'ı gizleniyordu. Bu tur:
     • dış şerit (başlık + "Bugün" + oklar) tamamen kaldırıldı,
     • RDP caption'ı (takvimin İÇİNDEKİ ay/yıl + ileri/geri okları)
       görünür kılındı,
     • nav aria-label'ları MEVCUT sözlük anahtarlarından verildi
       (TR/EN davranışı korunur, yeni anahtar yok).
   Seçim/disabled/fiyat davranışına DOKUNULMADI.
=============================================================== */

import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { tr } from "@/lib/i18n/dictionaries/tr";
import { en } from "@/lib/i18n/dictionaries/en";

vi.mock("@/app/context/CurrencyContext", () => ({
  useCurrency: () => ({ currency: "TRY", rates: { TRY: 1 } }),
}));

import BookingCalendar from "@/app/components/villa/booking/BookingCalendar";
import type { UseBookingEngineReturn } from "@/app/components/villa/booking/useBookingEngine";

const YEAR = 2026;
const MONTH_IDX = 9; /* Ekim */
const MONTH = new Date(YEAR, MONTH_IDX, 1);

function makeEngine(): UseBookingEngineReturn {
  return {
    startDate: null,
    endDate: null,
    setStartDate: vi.fn(),
    setEndDate: vi.fn(),
    mergedBlockedDates: [],
    mergedCheckinDates: [],
    mergedCheckoutDates: [],
    pendingCheckinDates: [],
    pendingCheckoutDates: [],
    pendingMiddleDates: [],
    today: new Date(YEAR, MONTH_IDX, 1),
    isIntersection: () => false,
    hasConflict: () => false,
    getPriceForDate: () => 10000,
    getDiscountedPriceForDate: () => null,
  } as unknown as UseBookingEngineReturn;
}

function renderCalendar(locale?: "tr" | "en") {
  const onMonthChange = vi.fn();
  const engine = makeEngine();
  const utils = render(
    <BookingCalendar
      engine={engine}
      currentMonth={MONTH}
      onCurrentMonthChange={onMonthChange}
      locale={locale}
    />
  );
  return { ...utils, onMonthChange, engine };
}

describe("dış nav strip", () => {
  it("1) 🔒 dış '[Ay Yıl … Bugün]' şeridi ARTIK YOK", () => {
    const { container, queryByText } = renderCalendar("tr");
    /* "Bugün" butonu yalnız dış şeritte vardı. */
    expect(queryByText(tr.booking.calendarToday)).toBeNull();
    /* Dış şeridin başlığı `<h3>` idi — kalmadı. */
    expect(container.querySelector("h3")).toBeNull();
  });

  it("2) takvimin İÇİNDEKİ ay/yıl başlığı (RDP caption) DURUYOR", () => {
    const { container } = renderCalendar("tr");
    const caption = container.querySelector(".rdp-caption");
    expect(caption).toBeTruthy();
    expect(caption?.textContent || "").toMatch(/Ekim\s*2026/i);
  });

  it("3) ay değiştirme çalışıyor (iç nav → onCurrentMonthChange)", () => {
    const { getByLabelText, onMonthChange } = renderCalendar("tr");
    fireEvent.click(getByLabelText(tr.availability.nextMonth));
    expect(onMonthChange).toHaveBeenCalled();
    fireEvent.click(getByLabelText(tr.availability.prevMonth));
    expect(onMonthChange).toHaveBeenCalledTimes(2);
  });

  it("4) TR/EN — nav aria-label'ları MEVCUT sözlükten gelir", () => {
    for (const [loc, dict] of [
      ["tr", tr],
      ["en", en],
    ] as const) {
      const { getByLabelText, queryByText, unmount } = renderCalendar(loc);
      expect(getByLabelText(dict.availability.nextMonth)).toBeTruthy();
      expect(getByLabelText(dict.availability.prevMonth)).toBeTruthy();
      /* Hiçbir dilde dış "Bugün" butonu YOK. */
      expect(queryByText(dict.booking.calendarToday)).toBeNull();
      unmount();
    }
  });

  it("5) 🔒 günler ve tarih seçimi DEĞİŞMEDİ", () => {
    const { container, engine } = renderCalendar("tr");
    const cells = Array.from(container.querySelectorAll('[role="gridcell"]'));
    expect(cells.length).toBeGreaterThan(20);
    const day9 = cells.find((el) => /^9₺/.test(el.textContent || ""));
    expect(day9).toBeTruthy();
    fireEvent.click(day9!);
    expect(engine.setStartDate).toHaveBeenCalled();
  });

  it("6) 🔒 günlük fiyat gösterimi DEĞİŞMEDİ", () => {
    const { container } = renderCalendar("tr");
    expect(container.textContent).toContain("₺10.000");
  });
});

/* ===============================================================
   B) MODAL DATEPICKER DİLİ — aktif locale ile eşleşir
   ===============================================================
   Kök neden: `VillaCardBookingModal` → `<BookingCalendar>` çağrısında
   `locale` prop'u GEÇİLMİYORDU → component "tr" default'una düşüyor ve
   takvim EN modallarda da Türkçe görünüyordu (BookingSidebar bu
   prop'u zaten geçiyordu). Aşağıdaki testler hem component seviyesinde
   hem de kaynak seviyesinde bu bağı kilitler.
=============================================================== */
describe("datepicker dili — locale paritesi", () => {
  function weekdays(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll(".rdp-head_cell")).map(
      (el) => (el.textContent || "").trim()
    );
  }
  function captionText(container: HTMLElement): string {
    return container.querySelector(".rdp-caption")?.textContent || "";
  }

  it("7) TR — Türkçe ay adı + Türkçe hafta günleri", () => {
    const { container } = renderCalendar("tr");
    expect(captionText(container)).toMatch(/Ekim\s*2026/i);
    /* date-fns tr kısa gün adları: Pt Sa Ça Pe Cu Ct Pz */
    expect(weekdays(container).join(" ")).toMatch(/Ça|Ct|Pz/);
  });

  it("8) EN — İngilizce ay adı + İngilizce hafta günleri", () => {
    const { container } = renderCalendar("en");
    expect(captionText(container)).toMatch(/October\s*2026/i);
    const w = weekdays(container).join(" ");
    expect(w).toMatch(/Mo|Tu|We/i);
    expect(w).not.toMatch(/Çar|Prş|Cmt/i);
  });

  it("10) locale değişince takvim dili değişir (TR ≠ EN)", () => {
    const trR = renderCalendar("tr");
    const trCap = captionText(trR.container);
    const trDays = weekdays(trR.container).join(" ");
    trR.unmount();

    const enR = renderCalendar("en");
    const enCap = captionText(enR.container);
    const enDays = weekdays(enR.container).join(" ");
    enR.unmount();

    expect(trCap).not.toBe(enCap);
    expect(trDays).not.toBe(enDays);
  });

  it("11) locale verilmezse varsayılan dil (EN)", () => {
    const { container } = renderCalendar(undefined);
    expect(captionText(container)).toMatch(/October\s*2026/i);
  });

  it("12) 🔒 kaynak kilidi — modal ve sidebar `locale` prop'unu GEÇER", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const clean = (rel: string) =>
      readFileSync(join(process.cwd(), rel), "utf-8").replace(
        /\/\*[\s\S]*?\*\//g,
        ""
      );
    for (const rel of [
      "app/components/villa/VillaCardBookingModal.tsx",
      "app/components/villa/BookingSidebar.tsx",
    ]) {
      const src = clean(rel);
      const call = src.slice(src.indexOf("<BookingCalendar"));
      const block = call.slice(0, call.indexOf("/>"));
      expect(block, rel).toMatch(/locale=\{locale\}/);
    }
  });
});
