"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

import { adminFetch } from "@/lib/admin-fetch";
import Section from "@/app/components/admin/villa-form/shared/Section";
import Label from "@/app/components/admin/villa-form/shared/Label";
import VillaCombobox from "@/app/(admin)/maki-admin/manual-reservations/ekle/VillaCombobox";
import { useNotify } from "@/app/components/admin/notifications/NotificationProvider";
import {
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  PUBLICATION_STATUSES,
  PUBLICATION_STATUS_LABELS,
  SALE_CURRENCIES,
  SALE_LIMITS,
  SALE_STATUSES,
  SALE_STATUS_LABELS,
  normalizeSaleSlug,
  validateSaleListingInput,
  validateSaleListingTranslationInput,
  validateStandalonePropertyInput,
  type PropertyType,
  type PublicationStatus,
  type SaleCurrency,
  type SaleListingSource,
  type SaleStatus,
} from "@/lib/sale-listing.helper";
import { saleDetailPath } from "@/lib/sale-listing-public.helper";
import SaleListingGallery from "./SaleListingGallery";
import type {
  SaleFormOptionsLite,
  SaleListingClientDetail,
  SaleVillaOptionLite,
} from "./types";

/* ===============================================================
   🛡️ SATILIK İLAN FORMU (oluştur / düzenle) — iki kaynak (108)
   ===============================================================
   • source="villa"      → bağlı villa seçilir; başlık, fotoğraf,
     olanak ve konum villadan gelir. Villa seçilince yatak odası /
     banyo boşsa villadaki değerle doldurulur (başlangıç verisi).
   • source="standalone" → bağımsız gayrimenkul: başlık (EN/TR), URL,
     bölge, olanaklar ve (kayıttan sonra) fotoğraf galerisi
     ilanın kendisine aittir. Kiralık villa kaydı oluşturulmaz.
   • Doğrulama client'ta ÖN kontrol (validate* yardımcıları); asıl
     karar sunucuda AYNI fonksiyonlarla verilir.
   • Dil: İngilizce canonical, Türkçe çeviri `translation_tr`.
   • Kiralık fiyat/takvim alanları bu formda YOK; yalnız
     /api/admin/sale-listings[/id] çağrılır.
   =============================================================== */

export type SaleFormState = {
  /* bağımsız gayrimenkul (108) */
  title: string;
  tr_title: string;
  slug: string;
  slug_touched: boolean;
  location_id: string;
  feature_ids: string[];
  /* ortak satış alanları */
  sale_price: string;
  sale_currency: SaleCurrency;
  price_on_request: boolean;
  sale_status: SaleStatus;
  property_type: PropertyType;
  plot_area_m2: string;
  built_area_m2: string;
  room_layout: string;
  bedrooms: string;
  bathrooms: string;
  floors: string;
  year_built: string;
  title_deed_type: string;
  has_garden: boolean;
  garden_area_m2: string;
  sale_description: string;
  seo_title: string;
  seo_description: string;
  sale_sort_order: string;
  is_featured: boolean;
  publication_status: PublicationStatus;
  tr_sale_description: string;
  tr_seo_title: string;
  tr_seo_description: string;
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function initialSaleFormState(detail?: SaleListingClientDetail | null): SaleFormState {
  const l = detail?.listing;
  const tr = detail?.translation_tr;
  return {
    title: str(l?.title),
    tr_title: str(tr?.title),
    slug: str(l?.slug),
    slug_touched: !!l?.slug,
    location_id: str(l?.location_id),
    feature_ids: detail?.feature_ids ?? [],
    sale_price: str(l?.sale_price),
    sale_currency: l?.sale_currency ?? "EUR",
    price_on_request: l?.price_on_request ?? false,
    sale_status: l?.sale_status ?? "available",
    property_type: l?.property_type ?? "villa",
    plot_area_m2: str(l?.plot_area_m2),
    built_area_m2: str(l?.built_area_m2),
    room_layout: str(l?.room_layout),
    bedrooms: str(l?.bedrooms),
    bathrooms: str(l?.bathrooms),
    floors: str(l?.floors),
    year_built: str(l?.year_built),
    title_deed_type: str(l?.title_deed_type),
    has_garden: l?.has_garden ?? false,
    garden_area_m2: str(l?.garden_area_m2),
    sale_description: str(l?.sale_description),
    seo_title: str(l?.seo_title),
    seo_description: str(l?.seo_description),
    sale_sort_order: str(l?.sale_sort_order ?? 0),
    is_featured: l?.is_featured ?? false,
    publication_status: l?.publication_status ?? "draft",
    tr_sale_description: str(tr?.sale_description),
    tr_seo_title: str(tr?.seo_title),
    tr_seo_description: str(tr?.seo_description),
  };
}

/** Form state → API gövdesi (saf; test edilir).
 *  villaId yalnız mevcut villadan OLUŞTURMADA; source="standalone" →
 *  `property` gönderilir (oluştururken `source` da). */
export function buildSaleListingRequestBody(
  form: SaleFormState,
  villaId?: string,
  source: SaleListingSource = "villa",
  mode: "create" | "edit" = villaId ? "create" : "edit"
) {
  const listing = {
    sale_price: form.sale_price,
    sale_currency: form.sale_currency,
    price_on_request: form.price_on_request,
    sale_status: form.sale_status,
    property_type: form.property_type,
    plot_area_m2: form.plot_area_m2,
    built_area_m2: form.built_area_m2,
    room_layout: form.room_layout,
    bedrooms: form.bedrooms,
    bathrooms: form.bathrooms,
    floors: form.floors,
    year_built: form.year_built,
    title_deed_type: form.title_deed_type,
    has_garden: form.has_garden,
    garden_area_m2: form.garden_area_m2,
    sale_description: form.sale_description,
    seo_title: form.seo_title,
    seo_description: form.seo_description,
    sale_sort_order: form.sale_sort_order,
    is_featured: form.is_featured,
    publication_status: form.publication_status,
  };
  const translation_tr = {
    title: source === "standalone" ? form.tr_title : "",
    sale_description: form.tr_sale_description,
    seo_title: form.tr_seo_title,
    seo_description: form.tr_seo_description,
  };
  if (source === "standalone") {
    const property = {
      title: form.title,
      slug: form.slug,
      location_id: form.location_id,
      feature_ids: form.feature_ids,
    };
    return mode === "create"
      ? { source: "standalone" as const, property, listing, translation_tr }
      : { property, listing, translation_tr };
  }
  return villaId ? { villa_id: villaId, listing, translation_tr } : { listing, translation_tr };
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-[var(--color-stone-400)]">{hint}</p>}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-[var(--color-stone-700)] cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="!w-4 !h-4 accent-[var(--color-champagne-500)]"
      />
      {label}
    </label>
  );
}

export default function SaleListingForm({
  mode,
  source: sourceProp,
  detail,
  villaOptions,
  initialVillaId,
  villaTitle,
  formOptions,
}: {
  mode: "create" | "edit";
  source?: SaleListingSource;
  detail?: SaleListingClientDetail | null;
  villaOptions?: SaleVillaOptionLite[];
  initialVillaId?: string;
  villaTitle?: string | null;
  formOptions?: SaleFormOptionsLite | null;
}) {
  const toast = useNotify();
  const router = useRouter();
  const source: SaleListingSource = detail?.listing.source ?? sourceProp ?? "villa";
  const standalone = source === "standalone";
  const listingId = detail?.listing.id ?? "";
  const [form, setForm] = useState<SaleFormState>(() => initialSaleFormState(detail));
  const [villaId, setVillaId] = useState<string>(
    detail?.listing.villa_id ?? initialVillaId ?? ""
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof SaleFormState>(key: K, value: SaleFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const input = (key: keyof SaleFormState, props?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      className="input"
      value={form[key] as string}
      onChange={(e) => set(key, e.target.value as never)}
      {...props}
    />
  );

  /* Mevcut villa seçilince yatak odası / banyo boşsa villadaki değer
     başlangıç verisi olarak girilir (sonra serbestçe düzenlenebilir). */
  const handleVillaChange = (id: string) => {
    setVillaId(id);
    const v = (villaOptions || []).find((o) => o.id === id);
    if (!v) return;
    setForm((prev) => ({
      ...prev,
      bedrooms: prev.bedrooms || str(v.bedrooms),
      bathrooms: prev.bathrooms || str(v.bathrooms),
    }));
  };

  const handleTitleChange = (value: string) =>
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: prev.slug_touched ? prev.slug : normalizeSaleSlug(value),
    }));

  const toggleFeature = (id: string, on: boolean) =>
    setForm((prev) => ({
      ...prev,
      feature_ids: on
        ? [...new Set([...prev.feature_ids, id])]
        : prev.feature_ids.filter((x) => x !== id),
    }));

  const handleSave = async () => {
    if (saving) return;
    if (mode === "create" && !standalone && !villaId) {
      toast.error("Bağlı villa seçin", { id: "sale-save" });
      return;
    }
    const body = buildSaleListingRequestBody(
      form,
      mode === "create" && !standalone ? villaId : undefined,
      source,
      mode
    );
    if ("property" in body) {
      const preP = validateStandalonePropertyInput(body.property);
      if (!preP.ok) {
        toast.error(preP.error, { id: "sale-save" });
        return;
      }
    }
    const pre = validateSaleListingInput(body.listing);
    if (!pre.ok) {
      toast.error(pre.error, { id: "sale-save" });
      return;
    }
    const preTr = validateSaleListingTranslationInput(body.translation_tr);
    if (!preTr.ok) {
      toast.error(preTr.error, { id: "sale-save" });
      return;
    }

    setSaving(true);
    try {
      const url =
        mode === "create"
          ? "/api/admin/sale-listings"
          : `/api/admin/sale-listings/${encodeURIComponent(listingId)}`;
      const res = await adminFetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        listing?: { id?: string; slug?: string | null };
      };
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast.success(mode === "create" ? "İlan oluşturuldu" : "İlan güncellendi", { id: "sale-save" });
      if (mode === "create" && json.listing?.id) {
        router.replace(`/maki-admin/sale-listings/${json.listing.id}`);
      } else if (standalone && json.listing?.slug) {
        set("slug", json.listing.slug);
      }
    } catch (err) {
      toast.error(mode === "create" ? "İlan oluşturulamadı" : "İlan güncellenemedi", {
        id: "sale-save",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const locations = formOptions?.locations || [];
  const features = formOptions?.features || [];
  let step = 0;
  const nextStep = () => `Adım ${++step}`;

  return (
    <div className="space-y-6" data-sale-form-source={source}>
      {standalone ? (
        <Section
          eyebrow={nextStep()}
          title="Gayrimenkul bilgileri"
          subtitle="Bağımsız gayrimenkul — kiralık villa kaydı gerekmez ve kiralık villa listesinde görünmez."
        >
          <div className="grid md:grid-cols-2 gap-4">
            <Field label={`Başlık (English — ana içerik) · ${form.title.length}/${SALE_LIMITS.title}`}>
              <input
                className="input"
                value={form.title}
                maxLength={SALE_LIMITS.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Sea view villa in Kalkan"
              />
            </Field>
            <Field label={`Başlık (Türkçe çeviri) · ${form.tr_title.length}/${SALE_LIMITS.title}`}>
              {input("tr_title", { maxLength: SALE_LIMITS.title, placeholder: "Kalkan'da deniz manzaralı villa" })}
            </Field>
            <Field
              label="URL (slug)"
              hint={form.slug ? `Adres: ${saleDetailPath(form.slug)} · Türkçe: /tr${saleDetailPath(form.slug)}` : "Başlıktan otomatik üretilir"}
            >
              <input
                className="input"
                value={form.slug}
                maxLength={SALE_LIMITS.slug}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, slug: e.target.value, slug_touched: true }))
                }
                onBlur={() => set("slug", normalizeSaleSlug(form.slug) || normalizeSaleSlug(form.title))}
                placeholder="sea-view-villa-in-kalkan"
              />
            </Field>
            <Field label="Bölge" hint="Liste sayfasındaki bölge filtresinde kullanılır.">
              <select className="input" value={form.location_id} onChange={(e) => set("location_id", e.target.value)}>
                <option value="">Bölge seçin…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name || "—"}</option>
                ))}
              </select>
            </Field>
          </div>
        </Section>
      ) : (
        <Section eyebrow={nextStep()} title="Bağlı villa" subtitle="İlan, mevcut bir villa kaydına bağlanır. Yalnız ilan türü satılık olan villalar listelenir.">
          {mode === "create" ? (
            <div className="max-w-xl space-y-2">
              <VillaCombobox
                villas={(villaOptions || []).map((v) => ({ id: v.id, title: v.title, slug: v.slug }))}
                value={villaId}
                onChange={handleVillaChange}
                placeholder="Villa seçin…"
              />
              {(villaOptions || []).length === 0 && (
                <p className="text-[12px] text-amber-700">
                  Satılık işaretli ve ilanı olmayan villa yok. Önce Mülkler → villa düzenle → “İlan türü” alanından satılık seçin.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium text-[var(--color-stone-900)]">{villaTitle || "—"}</span>
              <Link href={`/maki-admin/villas/${villaId}`} className="underline underline-offset-2 text-[var(--color-stone-600)]">
                Villa kaydını aç
              </Link>
            </div>
          )}
        </Section>
      )}

      <Section eyebrow={nextStep()} title="Fiyat ve durum" subtitle="Satış fiyatı kiralık fiyatlardan tamamen ayrıdır.">
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Satış fiyatı">
            {input("sale_price", { inputMode: "decimal", placeholder: "450000", disabled: form.price_on_request })}
          </Field>
          <Field label="Para birimi">
            <select className="input" value={form.sale_currency} onChange={(e) => set("sale_currency", e.target.value as SaleCurrency)}>
              {SALE_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Satış durumu">
            <select className="input" value={form.sale_status} onChange={(e) => set("sale_status", e.target.value as SaleStatus)}>
              {SALE_STATUSES.map((s) => (
                <option key={s} value={s}>{SALE_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end pb-2">
            <Check checked={form.price_on_request} onChange={(v) => set("price_on_request", v)} label="Fiyat sorunuz (fiyat gösterilmez)" />
          </div>
        </div>
      </Section>

      <Section eyebrow={nextStep()} title="Mülk bilgileri" subtitle="Satış ilanında gösterilecek yapı bilgileri.">
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Gayrimenkul tipi">
            <select className="input" value={form.property_type} onChange={(e) => set("property_type", e.target.value as PropertyType)}>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </Field>
          <Field label="Arsa alanı (m²)">{input("plot_area_m2", { inputMode: "decimal" })}</Field>
          <Field label="Kapalı alan (m²)">{input("built_area_m2", { inputMode: "decimal" })}</Field>
          <Field label="Oda sayısı" hint="Örn: 4+1">{input("room_layout", { maxLength: SALE_LIMITS.roomLayout })}</Field>
          <Field label="Yatak odası" hint={standalone ? undefined : "Boşsa villadaki değer gösterilir"}>
            {input("bedrooms", { inputMode: "numeric" })}
          </Field>
          <Field label="Banyo sayısı" hint={standalone ? undefined : "Boşsa villadaki değer gösterilir"}>
            {input("bathrooms", { inputMode: "numeric" })}
          </Field>
          <Field label="Kat sayısı">{input("floors", { inputMode: "numeric" })}</Field>
          <Field label="Yapım yılı">{input("year_built", { inputMode: "numeric", placeholder: "2020" })}</Field>
          <Field label="Tapu tipi">{input("title_deed_type", { maxLength: SALE_LIMITS.titleDeedType, placeholder: "Kat mülkiyeti" })}</Field>
          <div className="space-y-2">
            <Check checked={form.has_garden} onChange={(v) => set("has_garden", v)} label="Bahçe var" />
            {form.has_garden && input("garden_area_m2", { inputMode: "decimal", placeholder: "Bahçe alanı (m²)" })}
          </div>
        </div>
      </Section>

      {standalone && (
        <Section eyebrow={nextStep()} title="Özellikler" subtitle="Detay sayfasında “Genel özellikler” olarak gösterilir (mevcut olanak listesi kullanılır).">
          {features.length === 0 ? (
            <p className="text-sm text-[var(--color-stone-500)]">Tanımlı özellik yok.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2.5" data-sale-features>
              {features.map((f) => (
                <Check
                  key={f.id}
                  checked={form.feature_ids.includes(f.id)}
                  onChange={(on) => toggleFeature(f.id, on)}
                  label={f.name || "—"}
                />
              ))}
            </div>
          )}
        </Section>
      )}

      {standalone && (
        <Section eyebrow={nextStep()} title="Fotoğraf galerisi" subtitle="Bağımsız gayrimenkulün kendi fotoğrafları. İlk fotoğraf kapak olur; kapak ve sıra değiştirilebilir.">
          {mode === "edit" && listingId ? (
            <SaleListingGallery listingId={listingId} />
          ) : (
            <p className="text-sm text-[var(--color-stone-500)]" data-sale-gallery-pending>
              Fotoğraflar ilan oluşturulduktan sonra bu bölümden yüklenir.
            </p>
          )}
        </Section>
      )}

      <Section eyebrow={nextStep()} title="Açıklama" subtitle="İngilizce ana içeriktir; Türkçe çeviri /tr sayfalarında kullanılır.">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Açıklama (English — ana içerik)">
            <textarea
              className="input min-h-[180px]"
              maxLength={SALE_LIMITS.description}
              value={form.sale_description}
              onChange={(e) => set("sale_description", e.target.value)}
            />
          </Field>
          <Field label="Açıklama (Türkçe çeviri)">
            <textarea
              className="input min-h-[180px]"
              maxLength={SALE_LIMITS.description}
              value={form.tr_sale_description}
              onChange={(e) => set("tr_sale_description", e.target.value)}
            />
          </Field>
          <Field label={`SEO başlık (English) · ${form.seo_title.length}/${SALE_LIMITS.seoTitle}`}>
            {input("seo_title", { maxLength: SALE_LIMITS.seoTitle })}
          </Field>
          <Field label={`SEO başlık (Türkçe) · ${form.tr_seo_title.length}/${SALE_LIMITS.seoTitle}`}>
            {input("tr_seo_title", { maxLength: SALE_LIMITS.seoTitle })}
          </Field>
          <Field label={`SEO açıklama (English) · ${form.seo_description.length}/${SALE_LIMITS.seoDescription}`}>
            <textarea className="input min-h-[80px]" maxLength={SALE_LIMITS.seoDescription} value={form.seo_description} onChange={(e) => set("seo_description", e.target.value)} />
          </Field>
          <Field label={`SEO açıklama (Türkçe) · ${form.tr_seo_description.length}/${SALE_LIMITS.seoDescription}`}>
            <textarea className="input min-h-[80px]" maxLength={SALE_LIMITS.seoDescription} value={form.tr_seo_description} onChange={(e) => set("tr_seo_description", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section eyebrow={nextStep()} title="Sıralama ve yayın" subtitle="Sıralama ve yayın durumu. WhatsApp ve telefon Genel Ayarlar'dan alınır.">
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Sıralama" hint="Küçük sayı önce gösterilir">{input("sale_sort_order", { inputMode: "numeric" })}</Field>
          <Field label="Yayın durumu">
            <select className="input" value={form.publication_status} onChange={(e) => set("publication_status", e.target.value as PublicationStatus)}>
              {PUBLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>{PUBLICATION_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end pb-2">
            <Check checked={form.is_featured} onChange={(v) => set("is_featured", v)} label="Öne çıkar" />
          </div>
        </div>
      </Section>

      <div className="flex justify-end gap-3">
        <Link href="/maki-admin/sale-listings" className="btn-ghost">Vazgeç</Link>
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed">
          <Save size={15} />
          {saving ? "Kaydediliyor…" : mode === "create" ? "İlanı oluştur" : "Kaydet"}
        </button>
      </div>
    </div>
  );
}
