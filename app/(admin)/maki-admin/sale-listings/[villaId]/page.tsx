"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus } from "lucide-react";

import { adminFetch } from "@/lib/admin-fetch";
import SaleListingForm from "../_components/SaleListingForm";
import type { SaleListingClientDetail } from "../_components/types";

/* ===============================================================
   🛡️ /maki-admin/sale-listings/[villaId] — satılık ilan düzenle
   İlan yoksa (404) → "İlan oluştur" bağlantısı (?villa=<id>).
   =============================================================== */

export default function Page() {
  const params = useParams<{ villaId: string }>();
  const villaId = params?.villaId || "";
  const [detail, setDetail] = useState<SaleListingClientDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!villaId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch(`/api/admin/sale-listings/${encodeURIComponent(villaId)}`);
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        } & Partial<SaleListingClientDetail>;
        if (cancelled) return;
        if (res.status === 404) {
          setState("missing");
          return;
        }
        if (!res.ok || !json.ok || !json.listing) {
          setError(json.error || `HTTP ${res.status}`);
          setState("error");
          return;
        }
        setDetail({ listing: json.listing, translation_tr: json.translation_tr ?? null });
        setState("ready");
      } catch {
        if (!cancelled) {
          setError("İlan yüklenemedi");
          setState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [villaId]);

  return (
    <div className="space-y-8 w-full">
      <div>
        <p className="eyebrow">Satılık İlanlar</p>
        <h1 className="font-display text-3xl md:text-4xl text-[var(--color-stone-900)] mt-2 tracking-[-0.02em] truncate">
          {detail?.listing.villa?.title || "Satılık ilan"}
        </h1>
        <p className="text-sm text-[var(--color-stone-500)] mt-2">
          Satış bilgilerini, çeviriyi ve yayın durumunu güncelle.
        </p>
      </div>

      {state === "loading" && (
        <div className="card-premium p-10 text-center text-[var(--color-stone-500)]">Yükleniyor…</div>
      )}
      {state === "error" && (
        <div className="card-premium p-10 text-center text-sm text-red-600">{error}</div>
      )}
      {state === "missing" && (
        <div className="card-premium p-10 text-center space-y-4">
          <p className="text-sm text-[var(--color-stone-600)]">Bu villa için henüz satılık ilan yok.</p>
          <Link href={`/maki-admin/sale-listings/ekle?villa=${encodeURIComponent(villaId)}`} className="btn-primary inline-flex">
            <Plus size={15} />
            İlan oluştur
          </Link>
        </div>
      )}
      {state === "ready" && detail && (
        <SaleListingForm
          mode="edit"
          detail={detail}
          villaTitle={detail.listing.villa?.title ?? null}
        />
      )}
    </div>
  );
}
