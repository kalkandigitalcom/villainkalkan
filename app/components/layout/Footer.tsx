"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import { usePathname } from "next/navigation";

import { resolveAssetUrlVersioned } from "@/lib/storage.helpers";
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
import { DEFAULT_LOCALE, localeFromPathname } from "@/lib/i18n/config";
import { resolvePublicHome } from "@/lib/i18n/public-home";
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
import { categoryLinkHref, regionLinkHref } from "@/lib/taxonomy-landing";

/* ---------------- INLINE SOCIAL ICONS (stroke=currentColor) ---------------- */

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const YoutubeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

const TiktokIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

const WhatsappIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
  </svg>
);

/* ---------------- DRY HELPERS (dark-theme-aware) ---------------- */

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="
        group inline-flex items-center justify-center
        w-10 h-10 rounded-full
        border border-[var(--color-stone-200)] bg-white/5
        text-[var(--color-stone-500)]
        hover:border-brand/45 hover:bg-gradient-to-br hover:from-accent/10 hover:to-brand/10
        hover:text-accent
        transition-[color,background-color,border-color,transform]
        duration-300 motion-reduce:transition-none
        hover:scale-[1.05]
        focus:outline-none focus-visible:ring-2
        focus-visible:ring-white/50
      "
    >
      {children}
    </a>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="
        inline-flex items-center
        text-[14px] text-[var(--color-stone-500)]
        hover:text-accent
        hover:translate-x-[2px]
        transition-[color,transform] duration-300
        motion-reduce:transition-none motion-reduce:hover:translate-x-0
      "
    >
      {children}
    </Link>
  );
}

/* 🛡️ SEO landing — kategori → `/villa-turleri/<slug>`; bölge GRUP
   KÖKÜ → `/bolgeler/<slug>`. Alt bölge / slug'sız kayıt ESKİ
   `/arama?<prefix>=<slug|id>` URL'inde kalır (lib/taxonomy-landing). */
function taxonomyHref(prefix: string, item: TaxonomyItem): string {
  return prefix === "bolgeler" ? regionLinkHref(item) : categoryLinkHref(item);
}

/* =================================================================
   ROOT COMPONENT — client
   🛡️ PHASE 9B: DB erişimi YOK — tüm veri FooterWrapper'dan props
   olarak gelir. Yalnız locale tespiti + dictionary lookup + render.
=================================================================== */

type FooterProps = {
  settings: Settings | null;
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
  locations,
  villaTypes,
  corporatePages,
  year,
  siteName,
  phoneDigits,
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

  /* 🔄 TR ana sayfa yolu — varsayılan dil EN/DE iken "/" bir
     YÖNLENDİRİCİDİR, TR ana sayfa "/tr"'de yaşar. Logo linki "/"
     kalsaydı TR kullanıcı logoya basınca varsayılan dile geri
     düşerdi. `settings` prop'u ZATEN mevcut → YENİ PROP/FETCH YOK.
     Varsayılan "tr" veya multilingual kapalı → "/" (BYTE-IDENTICAL). */
  const { trHomeHref } = resolvePublicHome(settings);
  const homeHref =
    locale === DEFAULT_LOCALE ? trHomeHref : localeHref("/", locale);

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
         koyu zeminde ≈5:1). footer_logo (beyaz) AYNEN kullanılır. */
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
          className="pt-16 md:pt-24 pb-14 md:pb-20 text-center border-b border-[var(--color-stone-200)]"
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

        {/* ═════════════ SECTION 2 — MARKA + KEŞFET (asimetrik, kolon-kartı yok) ═════════════
            LEFT (dominant): logo + marka açıklaması + sosyal — mantık AYNEN.
            RIGHT: tek "Keşfet" başlığı altında iki minimal alt-grup (Villalar,
            Bölgeler); veri/link kaynakları BİREBİR aynı, yalnızca renk/zemin
            açık temaya göre revize edildi. */}
        <div className="pt-14 md:pt-16 grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-16">
          {/* LEFT — dominant brand block */}
          <div className="lg:col-span-5 space-y-7">
            <Link
              href={homeHref}
              className="font-display text-[24px] tracking-tight inline-flex items-center text-[var(--color-stone-900)]"
            >
              {settings?.footer_logo || settings?.site_logo ? (
                /* 🛡️ mig 048 — footer_logo varsa onu, yoksa site_logo'ya
                   fallback. resolveAssetUrlVersioned normalize. */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={
                    resolveAssetUrlVersioned(
                      settings.footer_logo,
                      settings.updated_at
                    ) ||
                    resolveAssetUrlVersioned(
                      settings.site_logo,
                      settings.updated_at
                    ) ||
                    ""
                  }
                  alt={`${siteName} logosu`}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <>
                  Villaya
                  <span className="text-accent ml-1">Gel</span>
                </>
              )}
            </Link>
            <p className="text-[14.5px] text-[var(--color-stone-500)] leading-relaxed max-w-sm">
              {dictionary.footer.tagline}
            </p>

            {/* Sosyal — settings'ten dinamik (mevcut API aynen) */}
            <div className="flex items-center gap-2.5">
              {settings?.instagram && (
                <SocialLink href={settings.instagram} label="Instagram">
                  <InstagramIcon width={15} height={15} aria-hidden />
                </SocialLink>
              )}
              {settings?.facebook && (
                <SocialLink href={settings.facebook} label="Facebook">
                  <FacebookIcon width={15} height={15} aria-hidden />
                </SocialLink>
              )}
              {settings?.youtube && (
                <SocialLink href={settings.youtube} label="YouTube">
                  <YoutubeIcon width={15} height={15} aria-hidden />
                </SocialLink>
              )}
              {settings?.tiktok && (
                <SocialLink href={settings.tiktok} label="TikTok">
                  <TiktokIcon width={15} height={15} aria-hidden />
                </SocialLink>
              )}
              {phoneDigits && (
                <SocialLink
                  href={`https://wa.me/${phoneDigits}`}
                  label="WhatsApp"
                >
                  <WhatsappIcon width={15} height={15} aria-hidden />
                </SocialLink>
              )}
            </div>

            {/* Adres + rezervasyon sorgulama (mevcut href AYNEN) — iletişim
                şeridi CTA'ya taşındığı için marka bloğunda. */}
            <div className="space-y-3">
              {settings?.address && (
                <p className="flex items-start gap-2 text-[13.5px] text-[var(--color-stone-500)] leading-relaxed max-w-sm">
                  <MapPin size={15} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-stone-400)]" />
                  <span>
                    <span className="sr-only">{dictionary.footer.address}: </span>
                    {settings.address}
                  </span>
                </p>
              )}
              <FooterLink href={localeHref("/rezervasyon-kontrol", locale)}>
                <span className="inline-flex items-center gap-1.5 text-[13.5px]">
                  {dictionary.footer.checkReservation}
                  <ArrowRight size={12} strokeWidth={1.75} aria-hidden />
                </span>
              </FooterLink>
            </div>
          </div>

          {/* RIGHT — "Keşfet" minimal link kümesi (villa_types + villa_locations) */}
          <div className="lg:col-span-7 lg:pl-6">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-stone-400)]">
              <span
                aria-hidden="true"
                className="inline-block w-4 h-px bg-gradient-to-r from-accent to-brand"
              />
              {dictionary.footer.explore}
            </span>

            <div className="mt-6 grid grid-cols-2 gap-x-10 gap-y-8">
              {/* VİLLA KATEGORİLERİ (dynamic villa_types) */}
              <nav aria-label={dictionary.footer.villaCategoriesAriaLabel}>
                <p className="text-[13px] font-medium text-[var(--color-stone-800)] mb-4">
                  {dictionary.footer.villas}
                </p>
                {villaTypes.length > 0 ? (
                  <ul className="space-y-3">
                    {villaTypes.map((t) => (
                      <li key={t.id}>
                        <FooterLink href={localeHref(taxonomyHref("villa-turleri", t), locale)}>
                          {resolveTaxonomyName(t.name, t.nameByLocale, locale)}
                        </FooterLink>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="space-y-3">
                    <li>
                      <FooterLink href={localeHref("/arama", locale)}>{dictionary.footer.allCategories}</FooterLink>
                    </li>
                  </ul>
                )}
              </nav>

              {/* POPÜLER BÖLGELER (dynamic villa_locations) */}
              <nav aria-label={dictionary.footer.popularRegionsAriaLabel}>
                <p className="text-[13px] font-medium text-[var(--color-stone-800)] mb-4">
                  {dictionary.footer.regions}
                </p>
                {locations.length > 0 ? (
                  <ul className="space-y-3">
                    {locations.map((loc) => (
                      <li key={loc.id}>
                        <FooterLink href={localeHref(taxonomyHref("bolgeler", loc), locale)}>
                          {loc.name}
                        </FooterLink>
                      </li>
                    ))}
                    <li className="pt-1">
                      <FooterLink href={localeHref("/arama", locale)}>
                        <span className="text-[13px] text-accent inline-flex items-center gap-1">
                          {dictionary.footer.allRegions}
                          <ArrowRight size={12} strokeWidth={1.75} aria-hidden />
                        </span>
                      </FooterLink>
                    </li>
                  </ul>
                ) : (
                  <ul className="space-y-3">
                    <li>
                      <FooterLink href={localeHref("/arama", locale)}>{dictionary.footer.exploreAllRegions}</FooterLink>
                    </li>
                  </ul>
                )}
              </nav>
            </div>
          </div>
        </div>

        {/* ═════════════ SECTION 4 — MİNİMAL ALT BAR ═════════════
            Sıra: copyright + kurumsal linkler → (ince separator) →
            KalkanDigital, ayrı ve tam ortalanmış, en son
            satır. `corporatePages` veri kaynağı BİREBİR aynı, yalnızca
            konum/sıra ve renkler değişti. */}
        <div className="mt-14 md:mt-16 pt-8 border-t border-[var(--color-stone-200)]">
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
