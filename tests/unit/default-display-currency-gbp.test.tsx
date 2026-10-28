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
import { useEffect } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";

import {
  AdminCurrencyScope,
  CurrencyProvider,
  useCurrency,
} from "@/app/context/CurrencyContext";
import ShortStayFeeNotice from "@/app/components/villa/ShortStayFeeNotice";
import {
  DEFAULT_DISPLAY_CURRENCY,
  canConvertForDisplay,
  collectSourceCurrencies,
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

/** Context değerini teste aktarır (effect içinde — render sırasında yan etki yok). */
function Grab({ onApi }: { onApi: (v: ReturnType<typeof useCurrency>) => void }) {
  const api = useCurrency();
  useEffect(() => { onApi(api); });
  return null;
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
  it("yeni ziyaretçi: varsayılan GBP; varsayılan kalıcı tercih olarak YAZILMAZ", async () => {
    mockFetchRates(RATES);
    render(<CurrencyProvider initialRates={RATES}><Probe /></CurrencyProvider>);
    expect(screen.getByTestId("currency").textContent).toBe("GBP");
    await act(async () => {});
    expect(localStorage.getItem("currency")).toBeNull();
    expect(document.cookie).not.toContain("currency=");
  });

  it("yeni ziyaretçi açıkça seçim yaparsa tercih kalıcı yazılır (GBP dahil)", async () => {
    mockFetchRates(RATES);
    let api: ReturnType<typeof useCurrency> | null = null;
    const capture = (v: ReturnType<typeof useCurrency>) => { api = v; };
    render(<CurrencyProvider initialRates={RATES}><Grab onApi={capture} /><Probe /></CurrencyProvider>);
    await act(async () => { api!.setCurrency("GBP"); });
    expect(localStorage.getItem("currency")).toBe("GBP");
    expect(document.cookie).toContain("currency=GBP");
    await act(async () => { api!.setCurrency("EUR"); });
    expect(screen.getByTestId("currency").textContent).toBe("EUR");
    expect(localStorage.getItem("currency")).toBe("EUR");
    expect(document.cookie).toContain("currency=EUR");
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

  it("geçersiz kayıtlı değer → GBP (geçersiz değer üzerine yazılmaz)", async () => {
    localStorage.setItem("currency", "JPY");
    mockFetchRates(RATES);
    render(<CurrencyProvider initialRates={RATES}><Probe /></CurrencyProvider>);
    await act(async () => {});
    expect(screen.getByTestId("currency").textContent).toBe("GBP");
    expect(localStorage.getItem("currency")).toBe("JPY");
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

/* ---------------- kaynak para birimine göre kur kapısı ---------------- */

describe("canConvertForDisplay / collectSourceCurrencies", () => {
  it("TRY → TRY kur verisi olmadan da gösterilir", () => {
    expect(canConvertForDisplay({}, "TRY", ["TRY"])).toBe(true);
    expect(canConvertForDisplay(null, "TRY", [null, undefined, ""])).toBe(true);
    expect(canConvertForDisplay({ TRY: 1 }, "TRY", [])).toBe(true);
  });

  it("kaynak === hedef ise kur gerekmez (GBP villa, GBP görünüm)", () => {
    expect(canConvertForDisplay({}, "GBP", ["GBP", "GBP"])).toBe(true);
  });

  it("gerekli kur yoksa false (tahmini kur yok)", () => {
    expect(canConvertForDisplay({ TRY: 1 }, "GBP", ["TRY"])).toBe(false);
    expect(canConvertForDisplay({ TRY: 1 }, "TRY", ["EUR"])).toBe(false);
    expect(canConvertForDisplay({ TRY: 1, EUR: 33 }, "GBP", ["EUR"])).toBe(false);
    expect(canConvertForDisplay({ TRY: 1, GBP: 0 }, "GBP", ["TRY"])).toBe(false);
    expect(canConvertForDisplay({ TRY: 1, GBP: NaN }, "GBP", ["TRY"])).toBe(false);
  });

  it("yalnız İLGİLİ kurlar aranır (diğer kurların eksikliği engellemez)", () => {
    expect(canConvertForDisplay({ TRY: 1, GBP: 40 }, "GBP", ["TRY"])).toBe(true);
    expect(canConvertForDisplay({ TRY: 1, EUR: 33 }, "TRY", ["EUR", "TRY"])).toBe(true);
    expect(canConvertForDisplay({ TRY: 1, EUR: 33, GBP: 40 }, "GBP", ["EUR"])).toBe(true);
  });

  it("collectSourceCurrencies: null → TRY, yüzde indirim atlanır, sabit indirim dahil", () => {
    expect(
      collectSourceCurrencies(
        [{ currency: "EUR" }, { currency: null }],
        [
          { currency: "USD", discount_type: "percent" },
          { currency: "GBP", discount_type: "fixed" },
        ],
        null,
        "eur"
      ).sort()
    ).toEqual(["EUR", "GBP", "TRY"]);
  });
});

describe("Provider: kur verisi eksik/geçersiz", () => {
  function SourceProbe({ sources }: { sources: string[] }) {
    const { currency, rates } = useCurrency();
    return (
      <span data-testid="can">
        {currency}:{String(canConvertForDisplay(rates, currency, sources))}
      </span>
    );
  }

  it("kur API hatası + sunucu kuru yok: TRY seçiliyken TRY fiyatı görünür, dövizli kaynak placeholder", async () => {
    localStorage.setItem("currency", "TRY");
    mockFetchRates({ error: "x" }, false);
    render(
      <CurrencyProvider>
        <Probe amountTry={40000} locale="tr" />
        <SourceProbe sources={["EUR"]} />
      </CurrencyProvider>
    );
    await waitFor(() => expect(screen.getByTestId("currency").textContent).toBe("TRY"));
    await act(async () => {});
    expect(screen.getByTestId("can").textContent).toBe("TRY:false");
  });

  it("GBP görünüm + GBP kuru geçersiz: TRY kaynaklı tutar gösterilmez", async () => {
    mockFetchRates({ USD: 30, EUR: 33, GBP: 0 });
    render(
      <CurrencyProvider>
        <SourceProbe sources={["TRY"]} />
      </CurrencyProvider>
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.getByTestId("can").textContent).toBe("GBP:false");
  });

  it("ShortStayFeeNotice: TRY ücret + TRY görünüm, kur yok → ₺ tutar görünür", async () => {
    localStorage.setItem("currency", "TRY");
    mockFetchRates({ error: "x" }, false);
    render(
      <CurrencyProvider>
        <ShortStayFeeNotice cleaningFee={5000} cleaningCurrency="TRY" cleaningLimit={3} locale="tr" />
      </CurrencyProvider>
    );
    await act(async () => {});
    fireEvent.click(screen.getByRole("button"));
    const note = screen.getByRole("note");
    expect(note.textContent).toBe(formatCurrency(5000, "TRY", "tr"));
  });

  it("ShortStayFeeNotice: EUR ücret + TRY görünüm, kur yok → yalnız placeholder", async () => {
    localStorage.setItem("currency", "TRY");
    mockFetchRates({ error: "x" }, false);
    render(
      <CurrencyProvider>
        <ShortStayFeeNotice cleaningFee={100} cleaningCurrency="EUR" cleaningLimit={3} locale="tr" />
      </CurrencyProvider>
    );
    await act(async () => {});
    fireEvent.click(screen.getByRole("button"));
    const note = screen.getByRole("note");
    expect(note.textContent).toBe(PRICE_PENDING_PLACEHOLDER);
    expect(note.textContent).not.toContain("₺");
  });

  it("ShortStayFeeNotice: EUR ücret + TRY görünüm, kur var → doğru çevrim", async () => {
    localStorage.setItem("currency", "TRY");
    mockFetchPending();
    render(
      <CurrencyProvider initialRates={RATES}>
        <ShortStayFeeNotice cleaningFee={100} cleaningCurrency="EUR" cleaningLimit={3} locale="tr" />
      </CurrencyProvider>
    );
    await waitFor(() => expect(localStorage.getItem("currency")).toBe("TRY"));
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("note").textContent).toBe(formatCurrency(3300, "TRY", "tr"));
  });
});

/* ---------------- admin kapsamı ---------------- */

describe("AdminCurrencyScope", () => {
  function AdminProbe() {
    const { currency } = useCurrency();
    return <span data-testid="admin-currency">{currency}</span>;
  }

  function renderAdmin() {
    return render(
      <CurrencyProvider initialRates={RATES}>
        <Probe />
        <AdminCurrencyScope>
          <AdminProbe />
        </AdminCurrencyScope>
      </CurrencyProvider>
    );
  }

  it("kayıtlı tercih yoksa admin TRY görür (ziyaretçi varsayılanı GBP'ye zorlanmaz) ve hiçbir şey yazılmaz", async () => {
    mockFetchRates(RATES);
    renderAdmin();
    expect(screen.getByTestId("admin-currency").textContent).toBe("TRY");
    await act(async () => {});
    expect(screen.getByTestId("admin-currency").textContent).toBe("TRY");
    expect(screen.getByTestId("currency").textContent).toBe("GBP");
    expect(localStorage.getItem("currency")).toBeNull();
    expect(document.cookie).not.toContain("currency=");
  });

  for (const saved of ["TRY", "USD", "EUR", "GBP"]) {
    it(`admin kayıtlı ${saved} tercihini korur`, async () => {
      localStorage.setItem("currency", saved);
      mockFetchRates(RATES);
      renderAdmin();
      await waitFor(() =>
        expect(screen.getByTestId("admin-currency").textContent).toBe(saved)
      );
      expect(localStorage.getItem("currency")).toBe(saved);
    });
  }

  it("admin cookie'deki tercihi de korur", async () => {
    document.cookie = "currency=EUR; path=/";
    mockFetchRates(RATES);
    renderAdmin();
    await waitFor(() =>
      expect(screen.getByTestId("admin-currency").textContent).toBe("EUR")
    );
  });

  it("admin kapsamında kur kapısı admin para birimine göre çalışır", async () => {
    mockFetchRates({ error: "x" }, false);
    let adminApi: ReturnType<typeof useCurrency> | null = null;
    const capture = (v: ReturnType<typeof useCurrency>) => { adminApi = v; };
    render(
      <CurrencyProvider>
        <AdminCurrencyScope><Grab onApi={capture} /></AdminCurrencyScope>
      </CurrencyProvider>
    );
    await act(async () => {});
    expect(adminApi!.currency).toBe("TRY");
    expect(canConvertForDisplay(adminApi!.rates, adminApi!.currency, ["TRY"])).toBe(true);
    expect(canConvertForDisplay(adminApi!.rates, adminApi!.currency, ["EUR"])).toBe(false);
  });
});

describe("admin layout para birimi kapsamı (kaynak kontrolü)", () => {
  it("app/(admin)/layout.tsx çocukları AdminCurrencyScope ile sarar", () => {
    const src = readFileSync(resolve(process.cwd(), "app/(admin)/layout.tsx"), "utf8");
    expect(src).toMatch(/<AdminCurrencyScope>\{children\}<\/AdminCurrencyScope>/);
  });
});
