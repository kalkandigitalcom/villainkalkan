/* ===============================================================
   🛡️ VARSAYILAN GÖRÜNTÜLEME PARA BİRİMİ = GBP
   ===============================================================
   • Yeni ziyaretçi → GBP
   • Kayıtlı TRY/USD/EUR/GBP (localStorage / cookie) → korunur
   • Kur yokken çevrilmiş tutar GÖSTERİLMEZ (placeholder, tahmini kur yok)
   • Kur gelince GBP çevrimi doğru
   • Dil ↔ para birimi bağımsız (TR+GBP, EN+GBP)
   • Arama / kiralık villa server cookie fallback = GBP
=============================================================== */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, act, waitFor } from "@testing-library/react";

import {
  CurrencyProvider,
  useCurrency,
} from "@/app/context/CurrencyContext";
import {
  DEFAULT_DISPLAY_CURRENCY,
  PRICE_PENDING_PLACEHOLDER,
  areDisplayRatesReady,
  convertPrice,
  formatCurrency,
  formatDisplayPrice,
  isDisplayCurrency,
  mergeValidRates,
  resolveDisplayCurrencyCookie,
} from "@/lib/currency";

const RATES = { USD: 30, EUR: 33, GBP: 40 };

function Probe({ amountTry = 40000, locale = "en" as "en" | "tr" }) {
  const { currency, rates, ratesReady } = useCurrency();
  const converted = convertPrice(amountTry, "TRY", currency, rates);
  return (
    <div>
      <span data-testid="currency">{currency}</span>
      <span data-testid="ready">{String(ratesReady)}</span>
      <span data-testid="price">
        {formatDisplayPrice(converted, currency, locale, ratesReady)}
      </span>
    </div>
  );
}

function clearCookie() {
  document.cookie = "currency=; path=/; max-age=0";
}

let fetchMock: ReturnType<typeof vi.fn>;

function mockFetchRates(body: unknown, ok = true) {
  fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
}

function mockFetchPending() {
  fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  localStorage.clear();
  clearCookie();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  clearCookie();
});

/* ---------------- saf yardımcılar ---------------- */

describe("currency helpers", () => {
  it("varsayılan görüntüleme para birimi GBP", () => {
    expect(DEFAULT_DISPLAY_CURRENCY).toBe("GBP");
  });

  it("isDisplayCurrency yalnız TRY/USD/EUR/GBP kabul eder", () => {
    for (const c of ["TRY", "USD", "EUR", "GBP"]) expect(isDisplayCurrency(c)).toBe(true);
    for (const c of ["", "gbp", "JPY", null, undefined, 1]) expect(isDisplayCurrency(c)).toBe(false);
  });

  it("resolveDisplayCurrencyCookie: geçerli değeri korur, yoksa/geçersizse GBP", () => {
    expect(resolveDisplayCurrencyCookie("TRY")).toBe("TRY");
    expect(resolveDisplayCurrencyCookie("USD")).toBe("USD");
    expect(resolveDisplayCurrencyCookie("EUR")).toBe("EUR");
    expect(resolveDisplayCurrencyCookie("GBP")).toBe("GBP");
    expect(resolveDisplayCurrencyCookie(undefined)).toBe("GBP");
    expect(resolveDisplayCurrencyCookie(null)).toBe("GBP");
    expect(resolveDisplayCurrencyCookie("")).toBe("GBP");
    expect(resolveDisplayCurrencyCookie("XYZ")).toBe("GBP");
  });

  it("mergeValidRates yalnız geçerli kurları alır, mevcut kuru bozmaz", () => {
    const base = { TRY: 1, USD: 30, EUR: 33, GBP: 40 };
    expect(mergeValidRates(base, { USD: NaN, EUR: 0, GBP: -1 })).toEqual(base);
    expect(mergeValidRates(base, null)).toEqual(base);
    expect(mergeValidRates({ TRY: 1 }, { USD: 31, EUR: 34, GBP: 41 })).toEqual({
      TRY: 1, USD: 31, EUR: 34, GBP: 41,
    });
  });

  it("areDisplayRatesReady: USD/EUR/GBP hepsi geçerli olmalı", () => {
    expect(areDisplayRatesReady({ TRY: 1 })).toBe(false);
    expect(areDisplayRatesReady({ TRY: 1, USD: 30, EUR: 33 })).toBe(false);
    expect(areDisplayRatesReady({ TRY: 1, ...RATES })).toBe(true);
  });

  it("formatDisplayPrice: kur hazır değilse placeholder, hazırsa formatCurrency ile birebir", () => {
    expect(formatDisplayPrice(1000, "GBP", "en", false)).toBe(PRICE_PENDING_PLACEHOLDER);
    expect(formatDisplayPrice(1000, "GBP", "en", false)).not.toContain("£");
    expect(formatDisplayPrice(1000, "GBP", "en", true)).toBe(formatCurrency(1000, "GBP", "en"));
    expect(formatDisplayPrice(1000, "GBP", "en")).toBe(formatCurrency(1000, "GBP", "en"));
  });

  it("dil ve para birimi bağımsız: TR+GBP ve EN+GBP", () => {
    const tr = formatDisplayPrice(1000, "GBP", "tr", true);
    const en = formatDisplayPrice(1000, "GBP", "en", true);
    expect(tr).toContain("£");
    expect(en).toContain("£");
    expect(tr).toBe(formatCurrency(1000, "GBP", "tr"));
    expect(en).toBe(formatCurrency(1000, "GBP", "en"));
  });
});

/* ---------------- Provider ---------------- */

describe("CurrencyProvider", () => {
  it("yeni ziyaretçi: varsayılan GBP ve tercih kalıcı yazılır", async () => {
    mockFetchRates(RATES);
    render(<CurrencyProvider initialRates={RATES}><Probe /></CurrencyProvider>);
    expect(screen.getByTestId("currency").textContent).toBe("GBP");
    await waitFor(() => expect(localStorage.getItem("currency")).toBe("GBP"));
    expect(document.cookie).toContain("currency=GBP");
  });

  for (const saved of ["TRY", "USD", "EUR", "GBP"]) {
    it(`kayıtlı ${saved} (localStorage) korunur`, async () => {
      localStorage.setItem("currency", saved);
      mockFetchRates(RATES);
      render(<CurrencyProvider initialRates={RATES}><Probe /></CurrencyProvider>);
      await waitFor(() => expect(screen.getByTestId("currency").textContent).toBe(saved));
      expect(localStorage.getItem("currency")).toBe(saved);
      expect(document.cookie).toContain(`currency=${saved}`);
    });

    it(`kayıtlı ${saved} (yalnız cookie) korunur`, async () => {
      document.cookie = `currency=${saved}; path=/`;
      mockFetchRates(RATES);
      render(<CurrencyProvider initialRates={RATES}><Probe /></CurrencyProvider>);
      await waitFor(() => expect(screen.getByTestId("currency").textContent).toBe(saved));
      expect(localStorage.getItem("currency")).toBe(saved);
    });
  }

  it("geçersiz kayıtlı değer → GBP", async () => {
    localStorage.setItem("currency", "JPY");
    mockFetchRates(RATES);
    render(<CurrencyProvider initialRates={RATES}><Probe /></CurrencyProvider>);
    await waitFor(() => expect(localStorage.getItem("currency")).toBe("GBP"));
    expect(screen.getByTestId("currency").textContent).toBe("GBP");
  });

  it("kayıtlı tercih okunmadan GBP ile üzerine yazılmaz", async () => {
    localStorage.setItem("currency", "TRY");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    mockFetchRates(RATES);
    render(<CurrencyProvider initialRates={RATES}><Probe /></CurrencyProvider>);
    await waitFor(() => expect(screen.getByTestId("currency").textContent).toBe("TRY"));
    const writes = setItem.mock.calls.filter(([k]) => k === "currency").map(([, v]) => v);
    expect(writes).not.toContain("GBP");
  });

  it("kur yüklenmeden yanlış GBP tutarı görünmez (placeholder)", async () => {
    mockFetchPending();
    render(<CurrencyProvider><Probe amountTry={40000} /></CurrencyProvider>);
    expect(screen.getByTestId("currency").textContent).toBe("GBP");
    expect(screen.getByTestId("ready").textContent).toBe("false");
    expect(screen.getByTestId("price").textContent).toBe(PRICE_PENDING_PLACEHOLDER);
    expect(screen.getByTestId("price").textContent).not.toContain("£");
  });

  it("kur geldikten sonra GBP çevrimi doğru (40.000 TRY / 40 = £1,000)", async () => {
    mockFetchRates(RATES);
    render(<CurrencyProvider><Probe amountTry={40000} locale="en" /></CurrencyProvider>);
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    expect(screen.getByTestId("price").textContent).toBe(formatCurrency(1000, "GBP", "en"));
  });

  it("sunucu kurları (initialRates) ile ilk render'da hazır — flicker yok", () => {
    mockFetchPending();
    render(<CurrencyProvider initialRates={RATES}><Probe amountTry={40000} locale="tr" /></CurrencyProvider>);
    expect(screen.getByTestId("ready").textContent).toBe("true");
    expect(screen.getByTestId("price").textContent).toBe(formatCurrency(1000, "GBP", "tr"));
  });

  it("kur API hatası/eksik veri mevcut kurları silmez", async () => {
    mockFetchRates({ error: "x" }, false);
    render(<CurrencyProvider initialRates={RATES}><Probe /></CurrencyProvider>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.getByTestId("ready").textContent).toBe("true");
  });

  it("kur API hatası + sunucu kuru yok → placeholder kalır (tahmini kur yok)", async () => {
    mockFetchRates({ error: "x" }, false);
    render(<CurrencyProvider><Probe /></CurrencyProvider>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.getByTestId("ready").textContent).toBe("false");
    expect(screen.getByTestId("price").textContent).toBe(PRICE_PENDING_PLACEHOLDER);
  });

  it("TRY seçiliyken kur beklenmeden doğru TRY tutarı (çevrim yok) — formatDisplayPrice sadece kapıya bağlı", () => {
    localStorage.setItem("currency", "TRY");
    mockFetchPending();
    render(<CurrencyProvider initialRates={RATES}><Probe amountTry={40000} locale="tr" /></CurrencyProvider>);
    return waitFor(() =>
      expect(screen.getByTestId("price").textContent).toBe(formatCurrency(40000, "TRY", "tr"))
    );
  });
});

/* ---------------- server cookie fallback (kaynak kontrolü) ---------------- */

describe("arama / kiralık villa server cookie fallback", () => {
  for (const f of [
    "app/components/search/AramaPageBody.tsx",
    "app/components/search/KiralikVillalarPageBody.tsx",
  ]) {
    it(`${f} cookie fallback'i resolveDisplayCurrencyCookie (GBP) kullanır`, () => {
      const src = readFileSync(resolve(process.cwd(), f), "utf8");
      expect(src).toMatch(/resolveDisplayCurrencyCookie\(\s*cookieStore\.get\("currency"\)\?\.value\s*\)/);
      expect(src).not.toMatch(/cookieStore\.get\("currency"\)\?\.value\s*\|\|\s*"TRY"/);
    });
  }
});
