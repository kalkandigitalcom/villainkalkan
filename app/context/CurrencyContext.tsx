"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  DEFAULT_DISPLAY_CURRENCY,
  areDisplayRatesReady,
  isDisplayCurrency,
  mergeValidRates,
} from "@/lib/currency";

type CurrencyContextType = {
  currency: string;

  setCurrency: (
    value: string
  ) => void;

  rates: Record<string, number>;

  /** 🛡️ USD/EUR/GBP kurlarının TAMAMI geçerli (finite > 0) mi?
   *  false iken çevrilmiş tutar GÖSTERİLMEZ (placeholder) — kur
   *  bilinmeden yapılan çevrim 1:1 fallback'e düşer ve yanlış tutar
   *  üretir (ör. ₺40.000 → "£40.000"). Tahmini kur KULLANILMAZ. */
  ratesReady: boolean;
};

/* ⚠️ Bu varsayılan YALNIZ CurrencyProvider DIŞINDA (izole bileşen
   render'ı / testler) kullanılır; site her zaman root layout'taki
   Provider içinde çalışır (orada varsayılan GBP + kur kapısı geçerli).
   Provider dışı davranış eskisiyle BİREBİR korunur (TRY, kapı yok). */
const CurrencyContext =
  createContext<CurrencyContextType>({
    currency: "TRY",

    setCurrency: () => {},

    rates: {},

    ratesReady: true,
  });

/** Mevcut tercih: önce localStorage (ana kaynak), yoksa `currency`
 *  cookie'si. Yalnız desteklenen kodlar (TRY/USD/EUR/GBP) kabul edilir;
 *  kayıt yoksa / geçersizse null → varsayılan (GBP) kalır. */
function readSavedCurrency(): string | null {
  try {
    const saved = localStorage.getItem("currency");
    if (isDisplayCurrency(saved)) return saved;
  } catch {
    /* localStorage erişilemez (gizli mod vb.) → cookie'ye düş */
  }
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)currency=([^;]*)/);
  const fromCookie = match ? decodeURIComponent(match[1]) : null;
  return isDisplayCurrency(fromCookie) ? fromCookie : null;
}

export function CurrencyProvider({
  children,
  initialRates,
}: {
  children: React.ReactNode;
  /** 🛡️ Sunucuda (root layout) okunan kurlar — ilk render'da (SSR dahil)
   *  doğru çevrim için. Yoksa kurlar istemcide yüklenene kadar
   *  `ratesReady=false` olur ve fiyatlar placeholder gösterilir. */
  initialRates?: Record<string, number> | null;
}) {

  /* 🛡️ VARSAYILAN GÖRÜNTÜLEME PARA BİRİMİ = GBP (yalnız ilk kez gelen
     ziyaretçi). Kayıtlı geçerli bir tercih varsa mount'ta o uygulanır.
     Kayıt / ödeme / fiyat doğrulama bu değerden ETKİLENMEZ. */
  const [currency, setCurrency] =
    useState<string>(DEFAULT_DISPLAY_CURRENCY);

  /* Kayıtlı tercih okunmadan localStorage/cookie'ye YAZILMAZ — aksi halde
     varsayılan, mevcut tercihin üzerine (kısa da olsa) yazılırdı. */
  const [preferenceLoaded, setPreferenceLoaded] =
    useState(false);

  const [rates, setRates] =
    useState<Record<string, number>>(() =>
      mergeValidRates({ TRY: 1 }, initialRates)
    );

  // local storage / cookie oku
  useEffect(() => {

    const saved = readSavedCurrency();

    if (saved) {
      setCurrency(saved);
    }

    setPreferenceLoaded(true);

  }, []);

  // local storage kaydet
  useEffect(() => {

    if (!preferenceLoaded) return;

    localStorage.setItem(
      "currency",
      currency
    );

    /* 🛡️ COOKIE DUAL-WRITE — server-side price sort için yardımcı.
       Mevcut localStorage davranışı KORUNUR (ana kaynak). Cookie
       sadece /arama ve /kiralik-villalar server component'lerinin
       sıralama anahtarını aktif para birimine göre hesaplayabilmesi
       için. UX, dropdown, render davranışı hiç değişmedi.
         path=/          → tüm route'larda erişilebilir
         max-age=1 yıl   → localStorage ile parity (persist)
         samesite=lax    → standart, third-party leak yok
       Server tarafı bunu `cookies().get("currency")` ile okur. */
    if (typeof document !== "undefined") {
      document.cookie =
        "currency=" +
        encodeURIComponent(currency) +
        "; path=/; max-age=31536000; samesite=lax";
    }

  }, [currency, preferenceLoaded]);

  // 🔥 KURLARI ÇEK
  useEffect(() => {

    async function fetchRates() {

      try {

        const res = await fetch(
          "/api/exchange-rates"
        );

        const data =
          await res.json();

        console.log(
          "KURLAR GELDİ:",
          data
        );

        /* Yalnız geçerli (finite > 0) kurlar güncellenir; hata yanıtı
           veya eksik kod mevcut (ör. sunucudan gelen) kuru BOZMAZ. */
        setRates((prev) =>
          mergeValidRates(prev, {
            USD: Number(data?.USD),

            EUR: Number(data?.EUR),

            GBP: Number(data?.GBP),
          })
        );

      } catch (err) {

        console.error(
          "Kur çekme hatası",
          err
        );
      }
    }

    fetchRates();

  }, []);

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        rates,
        ratesReady: areDisplayRatesReady(rates),
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () =>
  useContext(CurrencyContext);