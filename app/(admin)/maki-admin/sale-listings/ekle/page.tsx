"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { adminFetch } from "@/lib/admin-fetch";
import SaleListingForm from "../_components/SaleListingForm";
import type { SaleVillaOptionLite } from "../_components/types";

/* ===============================================================
   🛡️ /maki-admin/sale-listings/ekle — yeni satılık ilan
   ?villa=<uuid> → villa önceden seçili (villa düzenleme ekranından).
   =============================================================== */

function CreateInner() {
  const sp = useSearchParams();
  const [villas, setVillas] = useState<SaleVillaOptionLite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requested = (sp?.get("villa") || "").trim();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch("/api/admin/sale-listings/villa-options");
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          villas?: SaleVillaOptionLite[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setError(json.error || `HTTP ${res.status}`);
          setVillas([]);
          return;
        }
        setVillas(json.villas || []);
      } catch {
        if (!cancelled) {
          setError("Villa listesi yüklenemedi");
          setVillas([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (villas === null) {
    return (
      <div className="card-premium p-10 text-center text-[var(--color-stone-500)]">Yükleniyor…</div>
    );
  }

  const initialVillaId = villas.some((v) => v.id === requested) ? requested : undefined;
  return (
    <>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <SaleListingForm mode="create" villaOptions={villas} initialVillaId={initialVillaId} />
    </>
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
        <p className="text-sm text-[var(--color-stone-500)] mt-2">
          Satılık olarak işaretlenmiş bir villaya satış bilgilerini ekle.
        </p>
      </div>
      <Suspense fallback={null}>
        <CreateInner />
      </Suspense>
    </div>
  );
}
