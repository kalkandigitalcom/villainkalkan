/* ===============================================================
   🛡️ Villa detay — "Müsaitlik Takvimi" popup'ı
   ===============================================================
   Popup, rezervasyon kartının (BookingSidebar) MEVCUT BookingCalendar
   bileşenini AYNI engine ile açar: popup'ta seçilen tarihler kartın
   giriş/çıkış alanlarına ve fiyat özetine aktarılır. Kapatma: buton,
   dış alan, Escape. Açıkken arka plan kaydırması kilitli.
   =============================================================== */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";

vi.mock("@/app/services/settings.action", () => ({
  getPublicSettingsAction: vi.fn(async () => ({ prepayment_rate: 0 })),
}));

import BookingSidebar from "@/app/components/villa/BookingSidebar";
import { VillaAvailabilityShortcut } from "@/app/components/villa/VillaDetailActions";
import { openVillaAvailability } from "@/app/components/villa/villa-detail-events";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const tr = getDictionary("tr");
const en = getDictionary("en");

/* Bugün + 2 ay (sistem saatinden bağımsız). */
const base = new Date();
base.setDate(1);
base.setMonth(base.getMonth() + 2);
const Y = base.getFullYear();
const M = base.getMonth();
const ymd = (day: number) =>
  `${Y}-${String(M + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const pill = (day: number, bcp47 = "tr-TR") =>
  new Date(Y, M, day).toLocaleDateString(bcp47, {
    day: "numeric",
    month: "short",
  });

const PRICES = [
  { price: 5000, currency: "TRY", start_date: ymd(1), end_date: ymd(28) },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, ranges: [] }),
    })) as unknown as typeof fetch,
  );
  document.body.style.overflow = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderSidebar(locale: "tr" | "en" = "tr") {
  return render(
    <>
      <VillaAvailabilityShortcut locale={locale} />
      <BookingSidebar
        villaSlug="test-villa"
        villaId="v1"
        prices={PRICES}
        locale={locale}
      />
    </>,
  );
}

async function openPopup(d = tr) {
  fireEvent.click(
    screen.getByRole("button", { name: d.villaHero.availabilityCalendar }),
  );
  return screen.findByRole("dialog", {
    name: d.villaHero.availabilityCalendar,
  });
}

async function goToTargetMonth(dialog: HTMLElement, d = tr) {
  /* Takvim yüklenene kadar bekle, sonra 2 ay ileri. */
  const next = await within(dialog).findByRole(
    "button",
    { name: d.availability.nextMonth },
    { timeout: 5000 },
  );
  fireEvent.click(next);
  fireEvent.click(
    within(dialog).getByRole("button", { name: d.availability.nextMonth }),
  );
}

async function dayCell(dialog: HTMLElement, n: number) {
  const cells = await within(dialog).findAllByRole("gridcell");
  const cell = cells.find((el) =>
    new RegExp(`^${n}(?!\\d)`).test(el.textContent || ""),
  );
  if (!cell) throw new Error(`gün ${n} yok`);
  return cell;
}

describe("Müsaitlik Takvimi popup'ı", () => {
  it("buton popup'ı açar; sayfada ayrı takvim yoktur", async () => {
    renderSidebar();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const dialog = await openPopup();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    /* Takvim chunk'ı ilk açılışta tembel yüklenir. */
    expect(
      await within(dialog).findAllByRole("gridcell", {}, { timeout: 5000 }),
    ).not.toHaveLength(0);
  });

  it("popup'ta seçilen tarihler rezervasyon formuna aktarılır, fiyat hesaplanır", async () => {
    const { container } = renderSidebar();
    const dialog = await openPopup();
    await goToTargetMonth(dialog);

    fireEvent.click(await dayCell(dialog, 5));
    await waitFor(async () =>
      expect((await dayCell(dialog, 5)).className).toMatch(/rdp-day_selected/),
    );
    /* Giriş tarihi popup içindeki özet satırında da anında görünür. */
    expect(dialog.textContent).toContain(pill(5));

    fireEvent.click(await dayCell(dialog, 9));

    /* Seçim tamamlanınca popup kapanır (dropdown ile aynı davranış). */
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    const dateField = container.querySelector(
      "#booking-date-field",
    ) as HTMLElement;
    expect(dateField.textContent).toContain(pill(5));
    expect(dateField.textContent).toContain(pill(9));
    /* Mevcut fiyat özeti aynı engine'den hesaplanır. */
    expect(await screen.findByText("Toplam Tutar")).toBeInTheDocument();
  });

  it("açıkken arka plan kaydırması kilitli; kapanınca eski hâline döner", async () => {
    document.body.style.overflow = "auto";
    renderSidebar();
    await openPopup();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: tr.common.close }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(document.body.style.overflow).toBe("auto");
  });

  it("Escape ile kapanır", async () => {
    renderSidebar();
    await openPopup();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("dış alana (arka plan) tıklayınca kapanır", async () => {
    renderSidebar();
    const dialog = await openPopup();
    fireEvent.click(
      dialog.querySelector("[data-villa-availability-backdrop]") as HTMLElement,
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("olay köprüsü (şerit öğesi) de aynı popup'ı açar", async () => {
    renderSidebar();
    act(() => openVillaAvailability());
    expect(
      await screen.findByRole("dialog", {
        name: tr.villaHero.availabilityCalendar,
      }),
    ).toBeInTheDocument();
  });

  it("EN etiketleri", async () => {
    renderSidebar("en");
    const dialog = await openPopup(en);
    expect(
      within(dialog).getByRole("button", { name: en.common.close }),
    ).toBeInTheDocument();
    expect(dialog.textContent).toContain(en.booking.checkInPillLabel);
  });
});
