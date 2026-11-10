import type { ReactNode } from "react";
import {
  Bath,
  BedDouble,
  CalendarDays,
  Check,
  DoorOpen,
  Layers,
  LandPlot,
  MapPin,
  Ruler,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import Gallery from "@/app/components/villa/Gallery";
import VillaDistancesSection from "@/app/components/villa/VillaDistancesSection";
import VillaMapModal from "@/app/components/villa/VillaMapModal";
import SaleContactActions from "./SaleContactActions";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { formatDictionaryString } from "@/lib/i18n/format-dictionary-string";
import type { Locale } from "@/lib/i18n/config";
import {
  buildSalePhoneHref,
  buildSaleWhatsappHref,
  formatSalePrice,
} from "@/lib/sale-listing.helper";
import type { SaleVillaDetailData } from "./sale-villa-detail.types";

/* ===============================================================
   🏡 SATILIK VİLLA DETAY — ORTAK BİLEŞEN (önizleme + Aşama 5 public)
   ===============================================================
   Kiralık detayın TASARIM DİLİNİ (galeri, Manrope başlıklar, beyaz
   yuvarlak kartlar, sand-100 zemin, harita/yol tarifi paneli) referans
   alır; kiralık sayfanın kopyası DEĞİLDİR. Rezervasyon, takvim, kiralık
   fiyat ve favori bileşenleri KULLANILMAZ.
   Bileşen veri ÇEKMEZ — tamamen çözülmüş `SaleVillaDetailData` alır.
   `preview` → iletişim butonları devre dışı (bkz. SaleContactActions);
   `banner` → sayfa üstü önizleme uyarısı slotu (public'te verilmez).
=============================================================== */

function Card({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 rounded-[20px] bg-white px-5 py-6 md:px-7 md:py-7">
      <h2 className="font-display text-[20px] md:text-[22px] font-semibold tracking-[-0.015em] text-[var(--color-stone-900)]">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function SaleVillaDetail({
  data,
  locale,
  preview = false,
  banner,
}: {
  data: SaleVillaDetailData;
  locale: Locale;
  preview?: boolean;
  banner?: ReactNode;
}) {
  const dict = getDictionary(locale);
  const t = dict.sale;
  const l = data.listing;
  const sqm = (n: number) =>
    `${new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { maximumFractionDigits: 2 }).format(n)} ${t.sqm}`;

  const statusLabel =
    l.saleStatus === "sold"
      ? t.statusSold
      : l.saleStatus === "reserved"
        ? t.statusReserved
        : t.statusAvailable;
  const statusTone =
    l.saleStatus === "sold"
      ? "bg-[var(--color-stone-900)] text-white"
      : l.saleStatus === "reserved"
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-50 text-emerald-700";

  const priceText =
    l.priceOnRequest || l.salePrice === null
      ? t.priceOnRequest
      : formatSalePrice(l.salePrice, l.saleCurrency, locale === "tr" ? "tr" : "en");

  /* İletişim YALNIZ Genel Ayarlar'dan (ilan bazlı numara/fallback yok). */
  const whatsappHref = buildSaleWhatsappHref(
    data.siteWhatsappLink,
    data.sitePhone,
    formatDictionaryString(t.whatsappMessage, { title: data.title })
  );
  const phoneHref = buildSalePhoneHref(data.sitePhone);

  const facts: { key: string; Icon: LucideIcon; label: string; value: string }[] = [
    l.roomLayout ? { key: "rooms", Icon: DoorOpen, label: t.factRooms, value: l.roomLayout } : null,
    l.bedrooms ? { key: "bedrooms", Icon: BedDouble, label: t.factBedrooms, value: String(l.bedrooms) } : null,
    l.bathrooms ? { key: "bathrooms", Icon: Bath, label: t.factBathrooms, value: String(l.bathrooms) } : null,
    l.builtAreaM2 ? { key: "built", Icon: Ruler, label: t.factBuiltArea, value: sqm(l.builtAreaM2) } : null,
    l.plotAreaM2 ? { key: "plot", Icon: LandPlot, label: t.factPlotArea, value: sqm(l.plotAreaM2) } : null,
    l.floors ? { key: "floors", Icon: Layers, label: t.factFloors, value: String(l.floors) } : null,
    l.yearBuilt ? { key: "year", Icon: CalendarDays, label: t.factYearBuilt, value: String(l.yearBuilt) } : null,
  ].filter((f): f is NonNullable<typeof f> => f !== null);

  const technical: [string, string][] = [
    [t.techPropertyType, t.propertyTypes[l.propertyType] ?? l.propertyType],
    ...(l.roomLayout ? [[t.techRoomLayout, l.roomLayout] as [string, string]] : []),
    ...(l.builtAreaM2 ? [[t.factBuiltArea, sqm(l.builtAreaM2)] as [string, string]] : []),
    ...(l.plotAreaM2 ? [[t.factPlotArea, sqm(l.plotAreaM2)] as [string, string]] : []),
    [t.techGardenArea, l.hasGarden ? (l.gardenAreaM2 ? `${t.yes} · ${sqm(l.gardenAreaM2)}` : t.yes) : t.no],
    ...(l.floors ? [[t.factFloors, String(l.floors)] as [string, string]] : []),
    ...(l.yearBuilt ? [[t.factYearBuilt, String(l.yearBuilt)] as [string, string]] : []),
    ...(l.titleDeedType ? [[t.techTitleDeed, l.titleDeedType] as [string, string]] : []),
    [t.techSaleStatus, statusLabel],
  ];

  const hasMap =
    (data.map.mapType === "coords" && !!data.map.latitude && !!data.map.longitude) ||
    (data.map.mapType === "iframe" && !!data.map.mapEmbed);
  const showLocation = data.distances.length > 0 || hasMap;

  const paragraphs = (l.description || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div data-sale-villa-detail className="bg-[var(--color-sand-100)] pb-24 md:pb-32">
      {banner}

      {/* ═══ 1 — GENİŞ GALERİ ═══ */}
      {data.imageUrls.length > 0 && (
        <section className="bg-white px-5 md:px-10 lg:px-16 pt-5 md:pt-8 pb-6 md:pb-8">
          <div className="max-w-site mx-auto">
            <Gallery
              layout="grid"
              images={data.imageUrls}
              watermark={data.watermark}
              villaTitle={data.title}
              locale={locale}
            />
          </div>
        </section>
      )}

      {/* ═══ 2 — BAŞLIK + FİYAT ═══ */}
      <div className="px-5 md:px-10 lg:px-16">
        <div className="max-w-site mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 pt-8 md:pt-10">
          <div className="min-w-0 lg:col-span-8 space-y-6 md:space-y-8">
            <header>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-ink px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                  {t.forSale}
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-stone-600)]">
                  {t.propertyTypes[l.propertyType] ?? l.propertyType}
                </span>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusTone}`}>
                  {statusLabel}
                </span>
              </div>
              <h1 className="mt-4 font-display font-bold text-[26px] md:text-[34px] lg:text-[40px] leading-[1.08] tracking-[-0.02em] text-[var(--color-stone-900)] break-words">
                {data.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-[var(--color-stone-600)]">
                {data.locationName && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={15} className="text-accent" aria-hidden />
                    {data.locationName}
                  </span>
                )}
              </div>
              {/* Mobil/tablet: fiyat başlığın hemen altında (sağ kart lg+). */}
              <div className="lg:hidden mt-5 rounded-[16px] bg-white px-5 py-4" data-sale-price-mobile>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-stone-500)]">
                  {t.priceLabel}
                </p>
                <p className="mt-1 font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-stone-900)] tabular-nums">
                  {priceText}
                </p>
              </div>
            </header>

            {/* ═══ 3 — TEMEL BİLGİLER ═══ */}
            {facts.length > 0 && (
              <Card id="sale-facts" title={t.factsTitle}>
                <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {facts.map(({ key, Icon, label, value }) => (
                    <li key={key} className="flex items-center gap-3 rounded-xl bg-[var(--color-sand-50)] px-4 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--color-champagne-700)]">
                        <Icon size={16} strokeWidth={1.8} aria-hidden />
                      </span>
                      <span className="min-w-0 leading-tight">
                        <span className="block text-[11.5px] text-[var(--color-stone-500)]">{label}</span>
                        <strong className="block text-[14.5px] font-semibold text-[var(--color-stone-900)] tabular-nums">{value}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* ═══ 4 — AÇIKLAMA ═══ */}
            <Card id="sale-description" title={t.descriptionTitle}>
              {paragraphs.length > 0 ? (
                <div className="space-y-4 text-[14.5px] leading-[1.8] text-[var(--color-stone-700)]">
                  {paragraphs.map((p, i) => (
                    <p key={i} className="whitespace-pre-line">{p}</p>
                  ))}
                </div>
              ) : (
                <p className="text-[14px] italic text-[var(--color-stone-400)]">{t.descriptionEmpty}</p>
              )}
            </Card>

            {/* ═══ 5 — GENEL + TEKNİK ÖZELLİKLER ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-6 md:gap-8">
              <Card id="sale-features" title={t.generalFeaturesTitle}>
                {data.features.length === 0 ? (
                  <p className="text-[14px] italic text-[var(--color-stone-400)]">{t.generalFeaturesEmpty}</p>
                ) : (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {data.features.map((f) => (
                      <li key={f.id} className="flex items-center gap-2.5 text-[13.5px] text-[var(--color-stone-700)]">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-sand-100)]">
                          <Check size={12} className="text-[var(--color-champagne-600)]" aria-hidden />
                        </span>
                        {f.displayName}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card id="sale-technical" title={t.technicalTitle}>
                <dl className="divide-y divide-[var(--color-stone-100)] text-[13.5px]">
                  {technical.map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
                      <dt className="text-[var(--color-stone-500)]">{k}</dt>
                      <dd className="text-right font-medium text-[var(--color-stone-900)]">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>

            {/* ═══ 6 — HARİTA + KONUM ═══ */}
            {showLocation && (
              <section id="sale-location" className="scroll-mt-28">
                <h2 className="mb-4 font-display text-[20px] md:text-[22px] font-semibold tracking-[-0.015em] text-[var(--color-stone-900)]">
                  {t.locationTitle}
                </h2>
                <VillaDistancesSection
                  distances={data.distances}
                  locale={locale}
                  mapPanel={
                    hasMap ? (
                      <VillaMapModal
                        variant="panel"
                        mapType={data.map.mapType ?? undefined}
                        latitude={data.map.latitude ?? undefined}
                        longitude={data.map.longitude ?? undefined}
                        mapEmbed={data.map.mapEmbed ?? undefined}
                        villaTitle={data.title}
                        locale={locale}
                      />
                    ) : undefined
                  }
                />
              </section>
            )}
          </div>

          {/* ═══ FİYAT KARTI (sağ, sticky) ═══ */}
          <aside className="hidden lg:block lg:col-span-4">
            <div className="lg:sticky lg:top-28 rounded-[20px] bg-white p-6 md:p-7 shadow-soft" data-sale-price-card>
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-stone-500)]">
                {t.priceLabel}
              </p>
              <p className="mt-2 font-display text-[30px] md:text-[34px] font-bold leading-none tracking-[-0.02em] text-[var(--color-stone-900)] tabular-nums" data-sale-price>
                {priceText}
              </p>
              {!l.priceOnRequest && l.salePrice !== null && (
                <p className="mt-1.5 text-[12px] text-[var(--color-stone-400)]">{l.saleCurrency}</p>
              )}
              <div className="my-5 h-px bg-[var(--color-stone-100)]" />
              <p className="text-[14px] font-semibold text-[var(--color-stone-900)]">{t.contactTitle}</p>
              <p className="mt-1.5 mb-4 text-[13px] leading-relaxed text-[var(--color-stone-500)]">{t.contactBody}</p>
              <SaleContactActions
                whatsappHref={whatsappHref}
                phoneHref={phoneHref}
                locale={locale}
                preview={preview}
              />
            </div>
          </aside>
        </div>
      </div>

      {/* ═══ 7 — WHATSAPP BİLGİ ALANI ═══ */}
      {(whatsappHref || phoneHref) && (
        <section id="sale-contact" className="px-5 md:px-10 lg:px-16 mt-12 md:mt-16">
          <div className="max-w-site mx-auto rounded-[24px] bg-ink px-6 py-8 md:px-10 md:py-10 text-white grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-8">
              <h2 className="font-display text-[22px] md:text-[26px] font-bold tracking-[-0.015em]">{t.contactTitle}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-white/75">{t.contactBody}</p>
            </div>
            <div className="md:col-span-4">
              <SaleContactActions
                whatsappHref={whatsappHref}
                phoneHref={phoneHref}
                locale={locale}
                preview={preview}
                tone="dark"
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
