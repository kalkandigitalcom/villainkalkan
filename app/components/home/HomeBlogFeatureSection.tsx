import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, MapPin } from "lucide-react";

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  getCachedHomepageBlogFeature,
  type HomepageBlogFeature,
} from "@/lib/blog-homepage.server";
import { HomeSectionOrnament } from "@/app/components/home/HomeSectionHeading";
import { HOME_PANEL_SECTION_CLASS } from "@/app/components/home/home-panel";

/* ===============================================================
   🏝️ Ana sayfa — "Neden Kalkan?" görselli içerik bölümü
   ===============================================================
   İçerik TAMAMEN blog yazısından gelir (admin → Blog → "Ana sayfada
   göster"). Kod içinde sabit içerik YOK; yalnız buton metni sözlükten.
     • Etiket  : yazının kategorisi
     • Başlık  : yazı başlığı (TR/EN/DE çeviri katmanı)
     • Metin   : özet (excerpt) + gövdeden kısa özet (HTML söküldü)
     • Maddeler: gövdedeki ilk listenin öğeleri (varsa)
     • Görsel  : yazının kapak görseli
     • Bağlantı: mevcut blog detay rotası (/blog/<slug>)
   Seçili / yayında yazı yoksa bölüm HİÇ render edilmez.
   Beyaz zemin tam genişlikte section'da; içerik 1210px çizgide.
   =============================================================== */

export function HomeBlogFeatureView({
  feature,
  ctaLabel,
}: {
  feature: HomepageBlogFeature;
  ctaLabel: string;
}) {
  const { title, category, lead, summary, highlights, coverUrl, href } = feature;
  const headingId = "home-blog-feature-title";

  return (
    <section
      aria-labelledby={headingId}
      data-home-section="blog-feature"
      className={`${HOME_PANEL_SECTION_CLASS} bg-white`}
    >
      <div
        className={
          "max-w-site mx-auto grid grid-cols-1 items-center gap-8 md:gap-10 " +
          (coverUrl ? "lg:grid-cols-2 lg:gap-14" : "")
        }
      >
        {coverUrl ? (
          <div
            data-blog-feature-cover
            className="relative aspect-[4/3] w-full overflow-hidden rounded-[24px] md:rounded-[28px] bg-[var(--color-sand-50)] shadow-[0_28px_60px_-36px_rgba(27,46,94,0.5)]"
          >
            <Image
              src={coverUrl}
              alt={title}
              fill
              sizes="(max-width: 1024px) 100vw, 600px"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : null}

        <div className={coverUrl ? "min-w-0" : "min-w-0 max-w-3xl"}>
          {category ? (
            <span
              data-blog-feature-category
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3.5 py-1.5 text-[11.5px] font-semibold tracking-[0.02em] text-brand-strong ring-1 ring-brand/20"
            >
              <MapPin size={13} strokeWidth={2} aria-hidden="true" />
              {category}
            </span>
          ) : null}

          <h2
            id={headingId}
            className="mt-4 font-display text-[24px] md:text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] text-ink"
          >
            {title}
          </h2>
          <HomeSectionOrnament align="start" />

          {lead ? (
            <p className="mt-4 text-[14px] md:text-[15px] leading-relaxed text-[var(--color-stone-600)]">
              {lead}
            </p>
          ) : null}
          {summary ? (
            <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--color-stone-500)]">
              {summary}
            </p>
          ) : null}

          {highlights.length > 0 ? (
            <ul
              role="list"
              data-blog-feature-highlights
              className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2"
            >
              {highlights.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#FFFAF1] text-brand-strong ring-1 ring-brand/25"
                  >
                    <Check size={13} strokeWidth={2.25} />
                  </span>
                  <span className="text-[13px] leading-snug text-ink/85">{item}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <Link
            href={href}
            className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[13px] font-semibold tracking-[0.01em] text-white shadow-[0_14px_28px_-16px_rgba(27,46,94,0.7)] transition-colors duration-200 hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            {ctaLabel}
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
            <span className="sr-only">: {title}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function HomeBlogFeatureSection({
  locale = DEFAULT_LOCALE,
}: {
  locale?: Locale;
}) {
  const feature = await getCachedHomepageBlogFeature(locale);
  if (!feature) return null;
  return (
    <HomeBlogFeatureView
      feature={feature}
      ctaLabel={getDictionary(locale).home.blogFeature.cta}
    />
  );
}
