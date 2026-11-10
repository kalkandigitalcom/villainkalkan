"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Building2, Home } from "lucide-react";

import { adminFetch } from "@/lib/admin-fetch";
import SaleListingForm from "../_components/SaleListingForm";
import type { SaleFormOptionsLite, SaleVillaOptionLite } from "../_components/types";
import { resolveCreateKind, type CreateKind } from "../_components/create-kind";

/* ===============================================================
   🛡️ /maki-admin/sale-listings/ekle — yeni satılık ilan
   ===============================================================
   Parametresiz → iki seçenek (108):
     1) Mevcut Villadan Oluştur     → ?kaynak=villa
     2) Bağımsız Gayrimenkul Oluştur → ?kaynak=bagimsiz
   ?villa=<uuid> → mevcut villadan, villa önceden seçili (villa
   düzenleme ekranındaki bağlantı — geriye uyum).
   =============================================================== */

function Chooser() {
  const card =
    "card-premium p-6 md:p-7 flex flex-col gap-4 hover:border-[var(--color-champagne-400)] transition group";
  return (
    <div className="grid md:grid-cols-2 gap-5" data-sale-create-chooser>
      <Link href="/maki-admin/sale-listings/ekle?kaynak=villa" className={card} data-sale-create-option="villa">
        <div className="w-11 h-11 rounded-full bg-[var(--color-sand-100)] flex items-center justify-center">
          <Home size={17} className="text-[var(--color-champagne-700)]" />
        </div>
        <div>
          <h2 className="font-display text-xl text-[var(--color-stone-900)]">Mevcut Villadan Oluştur</h2>
          <p className="text-sm text-[var(--color-stone-500)] mt-1.5">
            Sistemde kayıtlı, satılık işaretli bir villayı seçin. Fotoğraflar, özellikler ve konum
            villadan gelir; satış bilgileri ve açıklamalar ilana özeldir. Kiralık ilan etkilenmez.
          </p>
        </div>
        <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-champagne-700)]">
          Villa seç <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
        </span>
      </Link>
      <Link href="/maki-admin/sale-listings/ekle?kaynak=bagimsiz" className={card} data-sale-create-option="standalone">
        <div className="w-11 h-11 rounded-full bg-[var(--color-sand-100)] flex items-center justify-center">
          <Building2 size={17} className="text-[var(--color-champagne-700)]" />
        </div>
        <div>
          <h2 className="font-display text-xl text-[var(--color-stone-900)]">Bağımsız Gayrimenkul Oluştur</h2>
          <p className="text-sm text-[var(--color-stone-500)] mt-1.5">
            Kiralık villa kaydı gerektirmez. Başlık, konum, özellikler, fotoğraf galerisi ve
            çevirileri doğrudan bu ilana girin. Kiralık villa listesinde görünmez.
          </p>
        </div>
        <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-champagne-700)]">
          Yeni gayrimenkul <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
        </span>
      </Link>
    </div>
  );
}

function useJson<T>(url: string | null): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch(url);
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string } & T;
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setState({ data: null, error: json.error || `HTTP ${res.status}` });
          return;
        }
        setState({ data: json, error: null });
      } catch {
        if (!cancelled) setState({ data: null, error: "Veriler yüklenemedi" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);
  return state;
}

function VillaCreate({ requested }: { requested: string }) {
  const { data, error } = useJson<{ villas?: SaleVillaOptionLite[] }>(
    "/api/admin/sale-listings/villa-options"
  );
  if (!data && !error) {
    return <div className="card-premium p-10 text-center text-[var(--color-stone-500)]">Yükleniyor…</div>;
  }
  const villas = data?.villas || [];
  const initialVillaId = villas.some((v) => v.id === requested) ? requested : undefined;
  return (
    <>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <SaleListingForm mode="create" source="villa" villaOptions={villas} initialVillaId={initialVillaId} />
    </>
  );
}

function StandaloneCreate() {
  const { data, error } = useJson<SaleFormOptionsLite>("/api/admin/sale-listings/form-options");
  if (!data && !error) {
    return <div className="card-premium p-10 text-center text-[var(--color-stone-500)]">Yükleniyor…</div>;
  }
  return (
    <>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <SaleListingForm
        mode="create"
        source="standalone"
        formOptions={{ locations: data?.locations || [], features: data?.features || [] }}
      />
    </>
  );
}

const SUBTITLES: Record<CreateKind, string> = {
  choose: "İlanı nasıl oluşturmak istediğinizi seçin.",
  villa: "Satılık olarak işaretlenmiş bir villaya satış bilgilerini ekleyin.",
  standalone: "Kiralık villa kaydı olmadan yeni bir satılık gayrimenkul oluşturun.",
};

function CreateInner() {
  const sp = useSearchParams();
  const requested = (sp?.get("villa") || "").trim();
  const kind = resolveCreateKind({ kaynak: sp?.get("kaynak"), villa: requested });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-stone-500)]">{SUBTITLES[kind]}</p>
        {kind !== "choose" && (
          <Link href="/maki-admin/sale-listings/ekle" className="text-sm underline underline-offset-2 text-[var(--color-stone-600)]">
            Oluşturma yöntemini değiştir
          </Link>
        )}
      </div>
      {kind === "choose" && <Chooser />}
      {kind === "villa" && <VillaCreate requested={requested} />}
      {kind === "standalone" && <StandaloneCreate />}
    </div>
  );
}

export default function Page() {
  return (
    <div className="space-y-8 w-full">
      <div>
        <p className="eyebrow">Satılık İlanlar</p>
        <h1 className="font-display text-3xl md:text-4xl text-[var(--color-stone-900)] mt-2 tracking-[-0.02em]">
          Yeni satılık ilan
        </h1>
      </div>
      <Suspense fallback={null}>
        <CreateInner />
      </Suspense>
    </div>
  );
}
