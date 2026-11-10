import Link from "next/link";
import { Eye } from "lucide-react";

import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import {
  saleListingPreviewHref,
  type PublicationStatus,
} from "@/lib/sale-listing.helper";

/* ===============================================================
   Admin önizleme uyarı şeridi — belirgin ama içerik tasarımını
   bozmayan, sayfanın en üstünde akışta (sticky DEĞİL) duran bant.
   Dil seçimi (EN ana içerik / TR çeviri) ve admin forma dönüş linki.
=============================================================== */
const STATUS_TR: Record<PublicationStatus, string> = {
  draft: "Taslak",
  published: "Yayında",
  unpublished: "Yayından kaldırıldı",
};

export default function SalePreviewBanner({
  listingId,
  locale,
  status,
}: {
  listingId: string;
  locale: Locale;
  status: PublicationStatus;
}) {
  /* Şerit admin arayüzüdür → her zaman Türkçe (önizlenen içerik dili
     EN/TR seçicisinden bağımsız). */
  const t = getDictionary("tr").sale;
  const base = saleListingPreviewHref(listingId);
  const pill = (active: boolean) =>
    "rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition " +
    (active ? "bg-white text-amber-900" : "text-white/85 hover:bg-white/15");
  return (
    <div
      role="status"
      data-sale-preview-banner
      className="bg-amber-600 text-white px-5 md:px-10 lg:px-16 py-3"
    >
      <div className="max-w-site mx-auto flex flex-wrap items-center gap-x-5 gap-y-2">
        <p className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[0.02em]">
          <Eye size={16} aria-hidden />
          {status === "published" ? t.previewBannerPublished : t.previewBannerTitle}
        </p>
        <p className="text-[12.5px] text-white/85">
          {t.previewStatusLabel}: <strong>{STATUS_TR[status]}</strong> · {t.previewBannerBody}
        </p>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1 rounded-full bg-white/10 p-0.5" aria-label={t.previewLanguageLabel}>
            <Link href={base} className={pill(locale === "en")} aria-current={locale === "en" ? "true" : undefined}>
              EN
            </Link>
            <Link href={saleListingPreviewHref(listingId, "tr")} className={pill(locale === "tr")} aria-current={locale === "tr" ? "true" : undefined}>
              TR
            </Link>
          </span>
          <Link
            href={`/maki-admin/sale-listings/${listingId}`}
            className="rounded-lg border border-white/40 px-3 py-1.5 text-[12.5px] font-medium hover:bg-white/10"
          >
            {t.previewBackToAdmin}
          </Link>
        </div>
      </div>
    </div>
  );
}
