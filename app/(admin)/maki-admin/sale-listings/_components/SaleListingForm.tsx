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
  validateSaleListingInput,
  validateSaleListingTranslationInput,
  type PropertyType,
  type PublicationStatus,
  type SaleCurrency,
  type SaleStatus,
} from "@/lib/sale-listing.helper";
import type {
  SaleListingClientDetail,
  SaleVillaOptionLite,
} from "./types";

/* ===============================================================
   🛡️ SATILIK İLAN FORMU (oluştur / düzenle)
   ===============================================================
   • Doğrulama client'ta ÖN kontrol olarak `validateSaleListingInput`
     ile yapılır; asıl karar sunucuda AYNI fonksiyonla verilir.
   • Dil: İngilizce canonical (sale_description / seo_*), Türkçe çeviri
     `translation_tr` (villa_sale_listing_translations, locale='tr').
   • Kiralık fiyat/takvim alanları bu formda YOK; yalnız
     /api/admin/sale-listings[/villaId] çağrılır.
   =============================================================== */

type FormState = {
  reference_code: string;
  sale_price: string;
  sale_currency: SaleCurrency;
  price_on_request: boolean;
  sale_status: SaleStatus;
  property_type: PropertyType;
  plot_area_m2: string;
  built_area_m2: string;
  room_layout: string;
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
  agent_whatsapp: string;
  agent_phone: string;
  publication_status: PublicationStatus;
  tr_sale_description: string;
  tr_seo_title: string;
  tr_seo_description: string;
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function initialSaleFormState(detail?: SaleListingClientDetail | null): FormState {
  const l = detail?.listing;
  const tr = detail?.translation_tr;
  return {
    reference_code: str(l?.reference_code),
    sale_price: str(l?.sale_price),
    sale_currency: l?.sale_currency ?? "EUR",
    price_on_request: l?.price_on_request ?? false,
    sale_status: l?.sale_status ?? "available",
    property_type: l?.property_type ?? "villa",
    plot_area_m2: str(l?.plot_area_m2),
    built_area_m2: str(l?.built_area_m2),
    room_layout: str(l?.room_layout),
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
    agent_whatsapp: str(l?.agent_whatsapp),
    agent_phone: str(l?.agent_phone),
    publication_status: l?.publication_status ?? "draft",
    tr_sale_description: str(tr?.sale_description),
    tr_seo_title: str(tr?.seo_title),
    tr_seo_description: str(tr?.seo_description),
  };
}

/** Form state → API gövdesi (saf; test edilir). */
export function buildSaleListingRequestBody(form: FormState, villaId?: string) {
  const listing = {
    reference_code: form.reference_code,
    sale_price: form.sale_price,
    sale_currency: form.sale_currency,
    price_on_request: form.price_on_request,
    sale_status: form.sale_status,
    property_type: form.property_type,
    plot_area_m2: form.plot_area_m2,
    built_area_m2: form.built_area_m2,
    room_layout: form.room_layout,
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
    agent_whatsapp: form.agent_whatsapp,
    agent_phone: form.agent_phone,
    publication_status: form.publication_status,
  };
  const translation_tr = {
    sale_description: form.tr_sale_description,
    seo_title: form.tr_seo_title,
    seo_description: form.tr_seo_description,
  };
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
  detail,
  villaOptions,
  initialVillaId,
  villaTitle,
}: {
  mode: "create" | "edit";
  detail?: SaleListingClientDetail | null;
  villaOptions?: SaleVillaOptionLite[];
  initialVillaId?: string;
  villaTitle?: string | null;
}) {
  const toast = useNotify();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialSaleFormState(detail));
  const [villaId, setVillaId] = useState<string>(
    detail?.listing.villa_id ?? initialVillaId ?? ""
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const input = (key: keyof FormState, props?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      className="input"
      value={form[key] as string}
      onChange={(e) => set(key, e.target.value as never)}
      {...props}
    />
  );

  const handleSave = async () => {
    if (saving) return;
    if (mode === "create" && !villaId) {
      toast.error("Bağlı villa seçin", { id: "sale-save" });
      return;
    }
    const body = buildSaleListingRequestBody(form, mode === "create" ? villaId : undefined);
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
          : `/api/admin/sale-listings/${encodeURIComponent(villaId)}`;
      const res = await adminFetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast.success(mode === "create" ? "İlan oluşturuldu" : "İlan güncellendi", { id: "sale-save" });
      if (mode === "create") {
        router.replace(`/maki-admin/sale-listings/${villaId}`);
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

  return (
    <div className="space-y-6">
      <Section eyebrow="Adım 1" title="Bağlı villa" subtitle="İlan, mevcut bir villa kaydına bağlanır. Yalnız ilan türü satılık olan villalar listelenir.">
        {mode === "create" ? (
          <div className="max-w-xl space-y-2">
            <VillaCombobox
              villas={(villaOptions || []).map((v) => ({ id: v.id, title: v.title, slug: v.slug }))}
              value={villaId}
              onChange={setVillaId}
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

      <Section eyebrow="Adım 2" title="Fiyat ve durum" subtitle="Satış fiyatı kiralık fiyatlardan tamamen ayrıdır.">
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Referans kodu" hint="Harf, rakam ve . _ - / — benzersiz">
            {input("reference_code", { maxLength: SALE_LIMITS.referenceCode, placeholder: "VIK-S-001" })}
          </Field>
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

      <Section eyebrow="Adım 3" title="Mülk bilgileri" subtitle="Satış ilanında gösterilecek yapı bilgileri.">
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
          <Field label="Banyo sayısı">{input("bathrooms", { inputMode: "numeric" })}</Field>
          <Field label="Kat sayısı">{input("floors", { inputMode: "numeric" })}</Field>
          <Field label="Yapım yılı">{input("year_built", { inputMode: "numeric", placeholder: "2020" })}</Field>
          <Field label="Tapu tipi">{input("title_deed_type", { maxLength: SALE_LIMITS.titleDeedType, placeholder: "Kat mülkiyeti" })}</Field>
          <div className="space-y-2">
            <Check checked={form.has_garden} onChange={(v) => set("has_garden", v)} label="Bahçe var" />
            {form.has_garden && input("garden_area_m2", { inputMode: "decimal", placeholder: "Bahçe alanı (m²)" })}
          </div>
        </div>
      </Section>

      <Section eyebrow="Adım 4" title="Açıklama" subtitle="İngilizce ana içeriktir; Türkçe çeviri /tr sayfalarında kullanılır.">
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

      <Section eyebrow="Adım 5" title="İletişim ve yayın" subtitle="Satış danışmanı iletişim bilgileri, sıralama ve yayın durumu.">
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="WhatsApp">{input("agent_whatsapp", { maxLength: SALE_LIMITS.phone, placeholder: "+90…" })}</Field>
          <Field label="Telefon">{input("agent_phone", { maxLength: SALE_LIMITS.phone, placeholder: "+90…" })}</Field>
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
