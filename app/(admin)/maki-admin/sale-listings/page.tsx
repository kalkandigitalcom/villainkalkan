"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { adminFetch } from "@/lib/admin-fetch";
import SaleListingList from "./_components/SaleListingList";
import type { SaleListingClientRow } from "./_components/types";

/* ===============================================================
   🛡️ /maki-admin/sale-listings — SATILIK İLANLAR (liste)
   ===============================================================
   Desen: manual-reservations / reservations listeleri ile aynı —
   client sayfa → adminFetch (Bearer) → /api/admin/sale-listings
   (authorizeAdminCaller + "sale_listings" izni) → service → repo.
   Filtre / arama / sayfalama client tarafında (kayıt sayısı villa
   sayısıyla sınırlı), URL state (?page, ?pageSize, ?status).
   =============================================================== */

export default function Page() {
  const [data, setData] = useState<SaleListingClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await adminFetch("/api/admin/sale-listings");
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          listings?: SaleListingClientRow[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setError(json.error || `HTTP ${res.status}`);
          setData([]);
          return;
        }
        setError(null);
        setData(json.listings || []);
      } catch (err) {
        if (cancelled) return;
        console.error("[sale-listings.list] EXCEPTION", err);
        setError("Liste yüklenemedi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Mülkler</p>
          <h1 className="font-display text-3xl md:text-4xl text-[var(--color-stone-900)] mt-2 tracking-[-0.02em]">
            Satılık İlanlar
          </h1>
          <p className="text-sm text-[var(--color-stone-500)] mt-2">
            Mevcut villalardan oluşturulan satılık ilanlar ve bağımsız
            gayrimenkuller. Kiralık fiyat, takvim ve rezervasyonlardan bağımsızdır.
          </p>
        </div>

        <Link href="/maki-admin/sale-listings/ekle" className="btn-primary self-start">
          <Plus size={15} />
          Yeni İlan Ekle
        </Link>
      </div>

      {loading ? (
        <div className="card-premium p-10 text-center text-[var(--color-stone-500)]">
          Yükleniyor…
        </div>
      ) : error ? (
        <div className="card-premium p-10 text-center text-red-600 text-sm">{error}</div>
      ) : (
        <Suspense fallback={null}>
          <SaleListingList initialData={data} />
        </Suspense>
      )}
    </div>
  );
}
