import type { Metadata } from "next";
import { notFound } from "next/navigation";

import DiscountCollection from "@/app/components/home/DiscountCollection";
import { DISCOUNT_CARD_DESIGN } from "@/app/components/home/discount-cards/discount-card-design";
import { toLocale } from "@/lib/i18n/config";

/* ===============================================================
   🧪 GELİŞTİRME ÖNİZLEMESİ — İndirimli villa kartı tasarımları
   ===============================================================
   Ana sayfadaki "İndirimli Kiralık Villalar" bölümünün kart
   tasarımlarını (C: public kart sistemi, A: Premium Yatay,
   B: Editoryal Lüks) GERÇEK veriyle
   (getCachedDiscountCollectionVillas) alt alta gösterir.

   - YALNIZ geliştirme ortamında açılır; production'da 404.
   - noindex; sitemap'te yok; hiçbir menüden bağlantı verilmez.
   - Dil: `?lang=en` → EN kartlar/yönlendirmeler (varsayılan TR).
   - Mobil karşılaştırma: tarayıcı genişliğini daraltın / cihaz modu.
   Ana sayfanın aktif tasarımı DISCOUNT_CARD_DESIGN sabitindedir.
   =============================================================== */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discount cards preview",
  robots: { index: false, follow: false },
};

export default async function DiscountCardsPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { lang } = await searchParams;
  const locale = toLocale(lang);

  return (
    <div className="pt-[140px] pb-16 bg-[var(--color-stone-50,#f7f8f7)]">
      {(["a", "b", "c"] as const).map((design) => (
        <div key={design} className="border-t border-dashed !border-[#244C45]/20 first:border-t-0">
          <p className="max-w-[1280px] mx-auto px-5 md:px-10 lg:px-16 pt-8 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#A88438]">
            {design.toUpperCase()}
            {design === DISCOUNT_CARD_DESIGN ? " · active" : ""}
          </p>
          <DiscountCollection locale={locale} design={design} />
        </div>
      ))}
    </div>
  );
}
