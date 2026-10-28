import {
  DEFAULT_LOCALE,
  LOCALE_BCP47,
  type Locale,
} from "@/lib/i18n/config";

/* ===============================================================
   🛡️ SAFE RATE RESOLVER (Faz 2A)
   ===============================================================
   Önceden `Number(rates?.[code] || 1)` kullanılıyordu. JS truthy
   kuralı gereği `0 || 1 → 1` olduğu için DB/feed'den 0 gelen kur
   sessizce 1'e düşüyordu (kur henüz gelmemişse fiyat hatalı
   şekilde "1:1" çevriliyordu — özellikle USD↔TRY büyük drift).
   `NaN`, `null`, `undefined` durumlarında da aynı sessiz fallback
   vardı.

   resolveRate açıkça:
     - finite ve > 0 olan kur değerini döner
     - aksi halde fallback (default 1) döner
   Geçerli, pozitif, finite kur input'ları için çıktı BYTE-IDENTICAL
   aynı; yalnız invalid kurlar artık explicit fallback'e düşürülüyor.

   Davranış değişmediği yerler:
     - amount === 0 (early return 0)
     - rates === null/undefined (early return amount)
     - from === to (Number(amount.toFixed(2)))
     - geçerli rate'ler (USD: 30, EUR: 33 vb.)
   =============================================================== */
function resolveRate(
  rates: Record<string, number> | null | undefined,
  code: string,
  fallback = 1
): number {
  const raw = rates?.[code];
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

export function convertPrice(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
) {

  if (!amount) {
    return 0;
  }

  if (!rates) {
    return amount;
  }

  // aynı currency
  if (from === to) {
    return Number(
      amount.toFixed(2)
    );
  }

  // TRY -> USD/EUR
  if (from === "TRY") {

    const targetRate = resolveRate(rates, to);

    return Number(
      (amount / targetRate).toFixed(2)
    );
  }

  // USD/EUR -> TRY
  if (to === "TRY") {

    const sourceRate = resolveRate(rates, from);

    return Number(
      (amount * sourceRate).toFixed(2)
    );
  }

  // USD -> EUR vb
  const sourceRate = resolveRate(rates, from);

  const targetRate = resolveRate(rates, to);

  const tryAmount =
    amount * sourceRate;

  return Number(
    (tryAmount / targetRate).toFixed(2)
  );
}

/* ===============================================================
   🛡️ PUBLIC ÇOKLU DİL — formatCurrency locale-aware
   ===============================================================
   `locale` OPSİYONEL ve son parametre → mevcut `formatCurrency(a, c)`
   çağrılarının TAMAMI (admin, mail, voucher, offer humanize, testler)
   `DEFAULT_LOCALE` = "tr" ile eskisiyle BYTE-IDENTICAL çalışır.

   Değişen TEK şey görüntüleme biçimi: BCP-47 etiketi MEVCUT
   `LOCALE_BCP47` haritasından gelir (tr → "tr-TR" AYNEN). Tutarın
   DEĞERİ, `currency` kodu, `style`/`maximumFractionDigits` ayarları
   ve tüm fiyat/kur hesaplama mantığı DEĞİŞMEDİ.
   =============================================================== */
export function formatCurrency(
  amount: number,
  currency: string,
  locale: Locale = DEFAULT_LOCALE
) {

  return new Intl.NumberFormat(
    LOCALE_BCP47[locale],
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }
  ).format(amount);
}
/* ===============================================================
   🛡️ GÖRÜNTÜLEME PARA BİRİMİ — VARSAYILAN + KUR HAZIRLIĞI
   ===============================================================
   Yalnız GÖRÜNTÜLEME katmanı içindir (CurrencyContext + fiyat
   gösteren public bileşenler). `convertPrice` / `formatCurrency`,
   villanın kendi para birimi, rezervasyon snapshot'ı (TRY), sunucu
   fiyat doğrulaması, ödeme, voucher ve e-postalar BUNLARDAN
   ETKİLENMEZ.
   =============================================================== */

/** Site para birimi seçicisindeki kodlar (TopBar CURRENCY_OPTIONS ile aynı). */
export const DISPLAY_CURRENCIES = ["TRY", "USD", "EUR", "GBP"] as const;

/** İlk kez gelen ziyaretçinin görüntüleme para birimi. */
export const DEFAULT_DISPLAY_CURRENCY = "GBP";

/** Sunucu tarafı cookie fallback'i (sıralama anahtarı) — istemci
 *  varsayılanıyla AYNI olmalı. */
export function resolveDisplayCurrencyCookie(
  value: string | null | undefined
): string {
  return isDisplayCurrency(value) ? value : DEFAULT_DISPLAY_CURRENCY;
}

export function isDisplayCurrency(
  value: unknown
): value is (typeof DISPLAY_CURRENCIES)[number] {
  return (
    typeof value === "string" &&
    (DISPLAY_CURRENCIES as readonly string[]).includes(value)
  );
}

function isValidRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** `base` üzerine `incoming` içindeki YALNIZ geçerli (finite > 0) kurları
 *  yazar; geçersiz/eksik değerler mevcut kuru bozmaz. TRY her zaman 1. */
export function mergeValidRates(
  base: Record<string, number>,
  incoming: Record<string, unknown> | null | undefined
): Record<string, number> {
  const next: Record<string, number> = { ...base, TRY: 1 };
  if (!incoming) return next;
  for (const code of DISPLAY_CURRENCIES) {
    if (code === "TRY") continue;
    const v = incoming[code];
    if (isValidRate(v)) next[code] = v;
  }
  return next;
}

/** USD/EUR/GBP kurlarının tamamı geçerli mi? Değilse çevrilmiş tutar
 *  gösterilmemelidir (convertPrice kur bilinmezse 1'e düşer → yanlış
 *  tutar). Villa fiyatları ve ek ücretler farklı para birimlerinde
 *  olabildiği için tek bir kur yeterli değildir. */
export function areDisplayRatesReady(
  rates: Record<string, number> | null | undefined
): boolean {
  if (!rates) return false;
  return DISPLAY_CURRENCIES.every(
    (code) => code === "TRY" || isValidRate(rates[code])
  );
}

/** Bir tutarın kaynak para birimi kodu. Boş/null kaynak, fiyat motoru
 *  ile AYNI şekilde TRY kabul edilir (`x.currency || "TRY"`). */
function normalizeSourceCurrency(code: string | null | undefined): string {
  return code ? String(code).toUpperCase() : "TRY";
}

type CurrencySourcePart =
  | string
  | null
  | undefined
  | ReadonlyArray<
      { currency?: string | null; discount_type?: string | null } | null | undefined
    >;

/** Gösterilecek tutara katkı veren kaynak para birimlerini toplar
 *  (villa fiyat satırları, sabit tutarlı indirimler, temizlik / havuz
 *  ısıtma para birimi vb.). Satır listelerinden `currency` alanı okunur;
 *  yüzde indirim satırları (`discount_type: "percent"`) para biriminden
 *  bağımsız olduğu için atlanır. */
export function collectSourceCurrencies(
  ...parts: CurrencySourcePart[]
): string[] {
  const out = new Set<string>();
  for (const part of parts) {
    if (part == null) continue;
    if (typeof part === "string") {
      out.add(normalizeSourceCurrency(part));
      continue;
    }
    for (const row of part) {
      if (!row || row.discount_type === "percent") continue;
      out.add(normalizeSourceCurrency(row.currency));
    }
  }
  return [...out];
}

/** `sources` para birimlerindeki tutarlar `target`'a GERÇEK kurla
 *  çevrilebilir mi? `convertPrice` TRY pivotludur:
 *    - kaynak === hedef → kur gerekmez
 *    - TRY → TRY        → kur gerekmez (TRY fiyatları HER ZAMAN görünür)
 *    - diğer tüm çevrimler → ilgili TRY dışı kodların geçerli kuru gerekir.
 *  Kur yoksa convertPrice 1'e düşer (yanlış tutar) — o durumda false
 *  döner ve yalnız o tutar yer tutucu ile gösterilir. Tahmini kur YOK. */
export function canConvertForDisplay(
  rates: Record<string, number> | null | undefined,
  target: string,
  sources: ReadonlyArray<string | null | undefined>
): boolean {
  const to = normalizeSourceCurrency(target);
  const from = sources.length
    ? sources.map(normalizeSourceCurrency)
    : ["TRY"];
  if (from.every((c) => c === to)) return true;
  const needed = new Set<string>([to, ...from]);
  for (const code of needed) {
    if (code === "TRY") continue;
    if (!isValidRate(rates?.[code])) return false;
  }
  return true;
}

/** Kur hazır değilken fiyat yerine gösterilen yer tutucu. */
export const PRICE_PENDING_PLACEHOLDER = "…";

/** Görüntüleme para birimine ÇEVRİLMİŞ bir tutarı biçimler; kurlar henüz
 *  hazır değilse (ratesReady=false) tahmini değer yerine yer tutucu döner.
 *  `formatCurrency` davranışı DEĞİŞMEZ — yalnız bu kapı eklenir. */
export function formatDisplayPrice(
  amount: number,
  currency: string,
  locale: Locale = DEFAULT_LOCALE,
  ratesReady = true
): string {
  return ratesReady
    ? formatCurrency(amount, currency, locale)
    : PRICE_PENDING_PLACEHOLDER;
}
