"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { usePathname } from "next/navigation";

import type { Settings } from "@/app/services/settings.types";
/* 🛡️ PHASE 9B — TaxonomyItem/CorporatePage tipleri artık FooterWrapper'da
   tanımlı (veriyi ÜRETEN yer) — buradan `import type` ile alınır; runtime
   yan etkisi YOK (yalnız tip, derleme sonrası erişilmez). */
import type { TaxonomyItem, CorporatePage } from "./FooterWrapper";
/* 🛡️ PHASE 2 — UI Translation Dictionary Core.
   🛡️ PHASE 9B GÜNCELLEMESİ — Footer artık "use client"; DB/service
   erişimi tamamen FooterWrapper.tsx'e taşındı (bkz. o dosya). Locale,
   Header.tsx'teki (Phase 9A) ile BİREBİR AYNI mekanizmayla — zaten
   mevcut `usePathname()` sonucundan `localeFromPathname()` (Phase 9A,
   lib/i18n/config.ts) ile tespit edilip `getDictionary(locale)` HER
   RENDER'DA çağrılır (saf/ucuz fonksiyon — DB sorgusu YOK). TR
   route'larında (pathname `/en`/`/de` ile başlamıyorsa) dictionary
   ÖNCEKİ modül-seviyesi sabitle (`getDictionary(DEFAULT_LOCALE)`)
   BİREBİR AYNI değerleri döner — TR render çıktısı DEĞİŞMEDİ.
   Middleware/headers() KULLANILMADI — bu component zaten client
   olduğu için Header'daki gibi gerek yok; site-wide dynamic-rendering
   riski YOK (bkz. Phase 9B audit — bu tasarımın seçilme nedeni). */
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";
import { localeFromPathname } from "@/lib/i18n/config";
/* 🛡️ NAVIGATION LOCALE PERSISTENCE — footer iç linkleri aktif locale'i
   taşır (bkz. lib/i18n/locale-href.ts). Dış bağlantılar (sosyal medya,
   tel/mailto) helper tarafından AYNEN geçirilir. */
import { localeHref } from "@/lib/i18n/locale-href";
/* 🛡️ PHASE 10L — admin'de girilen `footer_copyright` metninin EN/DE
   karşılığı (migration 083). Saf/senkron resolver; TR'de canonical
   değeri AYNEN döndürür (bkz. lib/i18n/settings-translation.helper.ts). */
import { resolveSettingsText } from "@/lib/i18n/settings-translation.helper";
/* 🛡️ PHASE 10H — villa tipi adı locale'e göre çözülür; çeviri yoksa
   canonical TR adı (saf helper, DB/server bağımlılığı YOK). */
import { resolveTaxonomyName } from "@/lib/i18n/taxonomy-name.helper";

/* =================================================================
   ROOT COMPONENT — client
   🛡️ PHASE 9B: DB erişimi YOK — tüm veri FooterWrapper'dan props
   olarak gelir. Yalnız locale tespiti + dictionary lookup + render.
=================================================================== */

type FooterProps = {
  settings: Settings | null;
  /* Keşfet / marka / sosyal alanı footer'dan kaldırıldı. Aşağıdaki üç
     alan FooterWrapper sözleşmesi bozulmasın diye tipte KALIR; Footer
     artık bunları render etmez. */
  locations: TaxonomyItem[];
  villaTypes: TaxonomyItem[];
  corporatePages: CorporatePage[];
  year: number;
  siteName: string;
  phoneDigits: string;
  /** Geliştirici kredisi logosu (Admin Logo, versiyonlu URL). Yoksa
   *  "KalkanDigital" metni gösterilir. */
  developerCreditLogoUrl?: string | null;
};

export default function Footer({
  settings,
  corporatePages,
  year,
  siteName,
  developerCreditLogoUrl = null,
}: FooterProps) {
  /* Logo yüklenemezse (silinmiş/erişilemiyor) metne düş. */
  const [creditLogoFailed, setCreditLogoFailed] = useState(false);
  const showCreditLogo = !!developerCreditLogoUrl && !creditLogoFailed;
  /* 🛡️ PHASE 9B — locale, Header.tsx (Phase 9A) ile BİREBİR AYNI şekilde
     `usePathname()` + `localeFromPathname()` ile saf/senkron türetilir;
     middleware/headers() gerektirmez. TR path'lerinde `dictionary`
     ÖNCEKİ modül-seviyesi sabitle (`getDictionary(DEFAULT_LOCALE)`)
     BİREBİR AYNI referans/değerleri döner. */
  const pathname = usePathname();
  const locale = localeFromPathname(pathname);
  const dictionary = getDictionary(locale);

  /* 🛡️ PHASE 10L §7 — `settings.translations` (migration 083) locale'e
     göre çözülür. `settings` prop'u zaten `getPublicSettings()`'ten
     geliyor; YENİ PROP EKLENMEDİ. TR'de sonuç canonical değerin
     KENDİSİDİR (aynı string referansı). */
  const copyrightTemplate = resolveSettingsText(
    settings?.footer_copyright,
    settings?.translations,
    locale,
    "footer_copyright"
  );

  return (
    <footer
      aria-label={dictionary.footer.ariaLabel}
      className="relative mt-20 md:mt-28 overflow-hidden text-[var(--color-stone-700)]"
      /* 🎨 Footer zemini: üstte marka laciverti #1B2E5E (--color-ink),
         alta doğru yumuşak bir mavi geçiş + altta hafif mavi ışıma
         (referans: koyu lacivert → mavi). Footer içindeki metin/çizgi renkleri
         `--color-stone-*` değişkenleriyle tanımlı → değişkenler YALNIZ bu
         elemanda açık tonlara yeniden eşlenir (yerleşim ve sınıflar aynı;
         site geneli ve admin ETKİLENMEZ). Hover/vurgu: mercan (#C8973A,
         koyu zeminde ≈5:1). */
      style={
        {
          background:
            "radial-gradient(ellipse 75% 60% at 50% 100%, rgb(64 112 196 / 0.32) 0%, transparent 70%), linear-gradient(180deg, var(--color-ink) 0%, #1d3268 45%, #22468c 100%)",
          "--color-stone-900": "#ffffff",
          "--color-stone-800": "#f1f4f8",
          "--color-stone-700": "#e2e8ef",
          "--color-stone-600": "#c8d2de",
          "--color-stone-500": "#afbccb",
          "--color-stone-400": "#a0afc0",
          "--color-stone-300": "#6f8299",
          "--color-stone-200": "rgba(255, 255, 255, 0.12)",
          /* globals.css'teki katmansız `* { border-color: var(--border) }`
             kuralı utility kenarlık rengini eziyor (açık gri #e3e9f0).
             Değişken YALNIZ footer kapsamında koyu zemine uygun ince
             beyaza eşlenir → ayırıcı çizgiler ve sosyal ikon kenarları
             zarif kalır; site geneli ETKİLENMEZ. */
          "--border": "rgba(255, 255, 255, 0.12)",
        } as React.CSSProperties
      }
    >
      {/* Üst geçiş — ince, ortada belirginleşen altın çizgi (dekoratif). */}
      <span
        aria-hidden="true"
        data-footer-top-line
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/45 to-transparent"
      />

      <div className="relative max-w-[calc(var(--container-site)+8rem)] mx-auto px-5 md:px-10 lg:px-16 pb-10">
        {/* ═════════════ SECTION 1 — İLETİŞİM / CTA (ortalı) ═════════════
            Başlık + alt başlık (sözlük, TR/EN), MEVCUT iletişim ayarlarından
            telefon ve e-posta (tel:/mailto: bağlantıları), "Bize Ulaşın"
            → mevcut iletişim sayfası (/iletisim, locale önekli). */}
        <section
          data-footer-cta
          aria-labelledby="footer-cta-title"
          className="pt-16 md:pt-24 pb-14 md:pb-20 text-center"
        >
          <h2
            id="footer-cta-title"
            /* text-white: globals.css'teki `h2.text-[var(--color-stone-900)]`
               başlık kuralı (lacivert) koyu zeminde görünmez olurdu. */
            className="font-display text-[30px] md:text-[44px] font-semibold leading-[1.1] tracking-[-0.02em] text-white"
          >
            {dictionary.footer.ctaTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] md:text-[17px] leading-relaxed text-[var(--color-stone-600)]">
            {dictionary.footer.ctaSubtitle}
          </p>

          {(settings?.phone || settings?.email) && (
            <div className="mx-auto mt-9 flex w-fit flex-col items-start gap-5 sm:w-auto sm:flex-row sm:items-center sm:justify-center sm:gap-0 sm:divide-x sm:divide-[var(--color-stone-200)]">
              {settings?.phone && (
                <a href={`tel:${settings.phone}`} className="group flex items-center gap-3.5 text-left sm:px-7">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 text-[var(--color-stone-800)] transition-colors duration-300 group-hover:bg-white/15 group-hover:text-accent motion-reduce:transition-none"
                  >
                    <Phone size={18} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-400)]">
                      {dictionary.footer.phone}
                    </span>
                    <span className="block text-[16px] md:text-[17px] font-semibold tracking-[0.01em] text-[var(--color-stone-900)] group-hover:text-accent transition-colors duration-300 motion-reduce:transition-none">
                      {settings.phone}
                    </span>
                  </span>
                </a>
              )}
              {settings?.email && (
                <a href={`mailto:${settings.email}`} className="group flex items-center gap-3.5 text-left sm:px-7">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 text-[var(--color-stone-800)] transition-colors duration-300 group-hover:bg-white/15 group-hover:text-accent motion-reduce:transition-none"
                  >
                    <Mail size={18} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-400)]">
                      {dictionary.footer.email}
                    </span>
                    <span className="block text-[16px] md:text-[17px] font-semibold tracking-[0.01em] text-[var(--color-stone-900)] group-hover:text-accent transition-colors duration-300 motion-reduce:transition-none break-all">
                      {settings.email}
                    </span>
                  </span>
                </a>
              )}
            </div>
          )}

          <Link
            href={localeHref("/iletisim", locale)}
            className="mt-10 inline-flex h-12 items-center justify-center rounded-full bg-brand px-9 text-[15px] font-semibold text-ink shadow-[0_16px_32px_-18px_rgba(200,151,58,0.8)] transition-colors duration-300 hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent motion-reduce:transition-none"
          >
            {dictionary.footer.ctaButton}
          </Link>
        </section>

        {/* ═════════════ SECTION 4 — MİNİMAL ALT BAR ═════════════
            Sıra: copyright + kurumsal linkler → (ince separator) →
            KalkanDigital, ayrı ve tam ortalanmış, en son
            satır. `corporatePages` veri kaynağı BİREBİR aynı, yalnızca
            konum/sıra ve renkler değişti. */}
        <div className="pt-8 border-t border-[var(--color-stone-200)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 text-[12px] text-[var(--color-stone-500)]">
            {/* 🛡️ PHASE 10L §7 — locale-aware telif metni.
                TR: `resolveSettingsText` canonical değeri AYNEN
                (trim'siz, aynı referansla) döndürür → aşağıdaki
                truthy kontrolü + iki `.replace()` + Türkçe fallback
                BİREBİR eskisi gibi çalışır (bit-bire aynı çıktı).
                EN/DE: çeviri varsa o, yoksa yine TR canonical.
                ⚠️ `{year}` / `{site_name}` yer tutucu ikamesi ÇEVİRİ
                metninde de AYNEN uygulanır — bu yüzden `.replace()`
                zinciri resolver'ın SONUCUNA uygulanıyor. */}
            <p>
              {copyrightTemplate
                ? copyrightTemplate
                    .replace(/\{year\}/g, String(year))
                    .replace(/\{site_name\}/g, siteName)
                : formatDictionaryString(
                    dictionary.footer.copyrightFallback,
                    { year, site_name: siteName }
                  )}
            </p>

            {corporatePages.length > 0 && (
              <nav
                aria-label={dictionary.footer.corporateAriaLabel}
                className="flex flex-wrap items-center gap-x-5 gap-y-2"
              >
                {corporatePages.map((p) => (
                  <Link
                    key={p.id}
                    href={localeHref(`/p/${p.slug}`, locale)}
                    className="hover:text-accent transition-colors duration-300 motion-reduce:transition-none"
                  >
                    {/* 🛡️ EN/DE `page_translations.title`; yoksa/boşsa
                        canonical TR `p.title` (villa tipi satırıyla AYNI
                        çözücü). `href` ve tasarım DEĞİŞMEDİ. */}
                    {resolveTaxonomyName(p.title, p.nameByLocale, locale)}
                  </Link>
                ))}
              </nav>
            )}
          </div>


          {/* 🛡️ KalkanDigital — ajans imzası. Logo: Admin → Webmaster →
              "Admin Logo" (FooterWrapper'dan versiyonlu URL); yoksa metin.
              Ayrı ve tam ortalanmış, footer'ın SON içeriği. */}
          <div className="mt-8 pt-6 border-t border-[var(--color-stone-200)] text-center">
            <a
              href="https://kalkandigital.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${dictionary.footer.webDevelopment}: KalkanDigital`}
              className="
                group inline-flex items-center justify-center gap-2
                text-[11.5px] tracking-[0.04em]
                text-[var(--color-stone-500)] hover:text-accent
                transition-colors duration-300 motion-reduce:transition-none
                focus:outline-none focus-visible:ring-2
                focus-visible:ring-white/50 rounded-full px-1
              "
            >
              <span>{dictionary.footer.webDevelopment}</span>
              <span aria-hidden="true" className="text-[var(--color-stone-300)]">
                :
              </span>
              {showCreditLogo ? (
                /* Düz <img>: Admin Logo SVG de olabilir (next/image SVG'yi
                   varsayılan olarak işlemez); boyut/opaklık AYNEN. */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={developerCreditLogoUrl!}
                  alt="KalkanDigital"
                  loading="lazy"
                  decoding="async"
                  onError={() => setCreditLogoFailed(true)}
                  className="h-9 md:h-10 w-auto max-w-[160px] object-contain opacity-75 group-hover:opacity-100 transition-opacity duration-300 motion-reduce:transition-none"
                />
              ) : (
                <span className="font-semibold tracking-[0.02em] text-[var(--color-stone-600)] group-hover:text-accent transition-colors duration-300 motion-reduce:transition-none">
                  KalkanDigital
                </span>
              )}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
