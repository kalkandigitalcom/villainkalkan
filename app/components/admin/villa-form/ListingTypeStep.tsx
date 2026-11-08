"use client";

import Link from "next/link";
import { AlertTriangle, Building2 } from "lucide-react";

import Section from "./shared/Section";
import RadioPill from "./shared/RadioPill";
import {
  LISTING_TYPES,
  LISTING_TYPE_LABELS,
  type ListingType,
} from "@/lib/sale-listing.helper";

/* ===============================================================
   🔥 ListingTypeStep — İlan türü (Kiralık / Satılık / Her ikisi)
   ===============================================================
   villa.listed_for_rent / listed_for_sale (migration 103). Sayfa
   state'i (`listingType`) payload'a üst seviye `listingType` olarak
   gider; kiralık form alanları (fiyat, takvim, kurallar) DEĞİŞMEZ.
   Satılık ilan bilgileri (fiyat, m², açıklama…) bu formda DEĞİL —
   ayrı "Satılık İlanlar" bölümünde yönetilir (kiralık fiyat
   tablolarına yanlışlıkla yazılmasın diye).
   =============================================================== */
export default function ListingTypeStep({
  value,
  onChange,
  villaId,
  initialValue,
}: {
  value: ListingType;
  onChange: (next: ListingType) => void;
  /** Düzenleme ekranında villa id (satılık ilan bağlantısı için). */
  villaId?: string;
  /** Düzenleme ekranında DB'den yüklenen ilk değer (uyarı için). */
  initialValue?: ListingType;
}) {
  const forSale = value === "sale" || value === "both";
  const leavingRental =
    initialValue !== undefined && initialValue !== "sale" && value === "sale";

  return (
    <Section
      eyebrow="İlan türü"
      title="Kiralık / Satılık"
      subtitle="Mülkün sitede hangi ilan türünde görüneceğini seçin. Yeni mülkler varsayılan olarak kiralıktır."
    >
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="İlan türü">
        {LISTING_TYPES.map((t) => (
          <RadioPill
            key={t}
            checked={value === t}
            onChange={() => onChange(t)}
            label={LISTING_TYPE_LABELS[t]}
          />
        ))}
      </div>

      {leavingRental && (
        <p className="mt-4 flex items-start gap-2 text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          “Sadece satılık” seçildiğinde mülk kiralık listelerden, arama ve
          rezervasyon akışından çıkar. Kiralık fiyat ve takvim verileri
          silinmez. İleri tarihli aktif rezervasyonu olan mülkte bu değişiklik
          kaydedilmez.
        </p>
      )}

      {forSale && (
        <div className="mt-4 text-[13px] text-[var(--color-stone-600)] flex flex-wrap items-center gap-2">
          <Building2 size={14} className="text-[var(--color-champagne-700)]" />
          {villaId && initialValue !== undefined && initialValue !== "rent" ? (
            <>
              Satış fiyatı, m² ve açıklama gibi bilgiler
              <Link
                href={`/maki-admin/sale-listings/${villaId}`}
                className="underline underline-offset-2 text-[var(--color-stone-900)]"
              >
                Satılık İlanlar
              </Link>
              bölümünden yönetilir.
            </>
          ) : (
            <>
              Kaydettikten sonra satış bilgilerini “Satılık İlanlar”
              bölümünden ekleyebilirsiniz.
            </>
          )}
        </div>
      )}
    </Section>
  );
}
