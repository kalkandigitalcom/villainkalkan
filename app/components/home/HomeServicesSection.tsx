import Link from "next/link";
import { ArrowRight, ClipboardCheck, Handshake, KeyRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { localeHref } from "@/lib/i18n/locale-href";
import HomeSectionHeading from "@/app/components/home/HomeSectionHeading";
import { HOME_PANEL_SECTION_CLASS } from "@/app/components/home/home-panel";

/* ===============================================================
   🤝 Ana sayfa — Hizmetlerimiz (üçlü hizmet kartı)
   ===============================================================
   Öne Çıkan Villalar'ın hemen altında. Kartlar beyaz, ince kenarlıklı,
   hafif gölgeli; ikon krem (#FFFAF1) daire içinde altın tonda. Hover:
   hafif yükselme + üst kenarda ince altın vurgu (motion-reduce'ta yok).

   Bağlantılar yalnız MEVCUT sayfalara: kiralama → /kiralik-villalar,
   satış ve yönetim → /iletisim (ayrı hizmet sayfası yok).
   =============================================================== */

type Service = {
  key: "rental" | "sale" | "management";
  Icon: LucideIcon;
  title: string;
  body: string;
  cta: string;
  href: string;
};

export default function HomeServicesSection({
  locale = DEFAULT_LOCALE,
}: {
  locale?: Locale;
}) {
  const dict = getDictionary(locale).home.services;
  const contactHref = localeHref("/iletisim", locale);

  const services: Service[] = [
    {
      key: "rental",
      Icon: KeyRound,
      title: dict.rentalTitle,
      body: dict.rentalBody,
      cta: dict.rentalCta,
      href: localeHref("/kiralik-villalar", locale),
    },
    {
      key: "sale",
      Icon: Handshake,
      title: dict.saleTitle,
      body: dict.saleBody,
      cta: dict.contactCta,
      href: contactHref,
    },
    {
      key: "management",
      Icon: ClipboardCheck,
      title: dict.managementTitle,
      body: dict.managementBody,
      cta: dict.contactCta,
      href: contactHref,
    },
  ];

  return (
    <section
      id="hizmetlerimiz"
      aria-label={dict.sectionAriaLabel}
      data-home-section="services"
      className={HOME_PANEL_SECTION_CLASS}
    >
      <div className="max-w-site mx-auto">
        <HomeSectionHeading title={dict.title} subtitle={dict.subtitle} />

        <ul
          role="list"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:gap-6 lg:grid-cols-3 sm:[&>li:last-child]:col-span-2 lg:[&>li:last-child]:col-span-1"
        >
          {services.map(({ key, Icon, title, body, cta, href }) => (
            <li key={key} className="flex">
              <article
                data-service-card={key}
                className="pub-card pub-card-hover pub-card-pad group relative flex w-full flex-col overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  data-service-icon
                  className="inline-flex size-11 items-center justify-center rounded-xl bg-[var(--color-stone-50)] text-brand-strong"
                >
                  <Icon size={20} strokeWidth={1.75} />
                </span>

                <h3 className="pub-card-title mt-5 text-[16px] md:text-[17px]">
                  {title}
                </h3>
                <p className="pub-card-text mt-2.5">
                  {body}
                </p>

                <div className="mt-auto pt-6">
                  <Link
                    href={href}
                    className="inline-flex items-center gap-1.5 rounded-full text-[12.5px] font-semibold tracking-[0.01em] text-brand-strong transition-colors duration-200 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                  >
                    {cta}
                    <ArrowRight
                      size={15}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                    />
                    <span className="sr-only">: {title}</span>
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
