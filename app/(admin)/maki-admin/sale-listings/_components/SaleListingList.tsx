"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  Eye,
  ChevronRight,
  Pencil,
  Search,
  Star,
  Trash2,
} from "lucide-react";

import { adminFetch } from "@/lib/admin-fetch";
import { normalizeSearchText } from "@/lib/search";
import { formatDateTr } from "@/lib/date-format";
import { formatMoney } from "@/lib/format";
import {
  PUBLICATION_STATUSES,
  PUBLICATION_STATUS_LABELS,
  saleListingPreviewHref,
  type PublicationStatus,
} from "@/lib/sale-listing.helper";
import {
  useConfirm,
  useNotify,
} from "@/app/components/admin/notifications/NotificationProvider";
import type { SaleListingClientRow } from "./types";

/* ===============================================================
   🛡️ SATILIK İLAN LİSTESİ — filtre (yayın durumu), arama (villa adı /
   referans kodu), client-side sayfalama (manual-reservations paritesi:
   ?page, ?pageSize, ?status URL state; default'lar URL'e yazılmaz).
   Silme: DELETE /api/admin/sale-listings/[villaId] (server-side audit).
   =============================================================== */

const ALLOWED_PAGE_SIZES = [10, 30, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 30;
type StatusFilter = "all" | PublicationStatus;

function parsePageSize(raw: string | null): number {
  const n = Number(raw);
  return (ALLOWED_PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}
function parsePage(raw: string | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
function parseStatus(raw: string | null): StatusFilter {
  return raw && (PUBLICATION_STATUSES as readonly string[]).includes(raw)
    ? (raw as PublicationStatus)
    : "all";
}

/** Saf filtre — test edilir (tests/unit/sale-listings-admin.test.ts). */
export function filterSaleListings(
  rows: ReadonlyArray<SaleListingClientRow>,
  status: StatusFilter,
  search: string
): SaleListingClientRow[] {
  const q = normalizeSearchText(search);
  return rows.filter((r) => {
    if (status !== "all" && r.publication_status !== status) return false;
    if (!q) return true;
    const hay = normalizeSearchText(`${r.villa?.title || ""} ${r.reference_code || ""}`);
    return hay.includes(q);
  });
}

const STATUS_BADGE: Record<PublicationStatus, string> = {
  published: "admin-badge admin-badge--confirmed",
  draft: "admin-badge admin-badge--neutral",
  unpublished: "admin-badge admin-badge--rejected",
};

function priceLabel(r: SaleListingClientRow): string {
  if (r.price_on_request) return "Fiyat sorunuz";
  if (r.sale_price === null || r.sale_price === undefined) return "—";
  return formatMoney(Number(r.sale_price), r.sale_currency);
}

function villaWarning(r: SaleListingClientRow): string | null {
  const v = r.villa;
  if (!v) return "Villa bulunamadı";
  if (v.deleted_at) return "Villa çöp kutusunda";
  if (v.listed_for_sale !== true) return "Villa satılık işaretli değil";
  if (v.is_active === false) return "Villa pasif";
  return null;
}

export default function SaleListingList({
  initialData,
}: {
  initialData: SaleListingClientRow[];
}) {
  const toast = useNotify();
  const confirm = useConfirm();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pageSize = parsePageSize(searchParams?.get("pageSize") ?? null);
  const pageFromUrl = parsePage(searchParams?.get("page") ?? null);
  const status = parseStatus(searchParams?.get("status") ?? null);

  const buildHref = useCallback(
    (next: { page?: number; pageSize?: number; status?: StatusFilter }) => {
      const sp = new URLSearchParams(searchParams?.toString() || "");
      if (next.page !== undefined) {
        if (next.page <= 1) sp.delete("page");
        else sp.set("page", String(next.page));
      }
      if (next.pageSize !== undefined) {
        if (next.pageSize === DEFAULT_PAGE_SIZE) sp.delete("pageSize");
        else sp.set("pageSize", String(next.pageSize));
      }
      if (next.status !== undefined) {
        if (next.status === "all") sp.delete("status");
        else sp.set("status", next.status);
      }
      const qs = sp.toString();
      return qs ? `?${qs}` : "?";
    },
    [searchParams]
  );

  const visible = useMemo(
    () => filterSaleListings(data, status, search),
    [data, status, search]
  );
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: data.length, draft: 0, published: 0, unpublished: 0 };
    for (const r of data) c[r.publication_status] += 1;
    return c;
  }, [data]);

  const totalItems = visible.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(pageFromUrl, totalPages);
  const pageItems = visible.slice((page - 1) * pageSize, page * pageSize);
  const rangeStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalItems);

  useEffect(() => {
    if (pageFromUrl > totalPages) {
      router.replace(buildHref({ page: totalPages }), { scroll: false });
    }
  }, [pageFromUrl, totalPages, router, buildHref]);

  const go = (next: Parameters<typeof buildHref>[0]) =>
    router.replace(buildHref(next), { scroll: false });

  const handleDelete = async (row: SaleListingClientRow) => {
    const ok = await confirm({
      title: "Satılık ilan silinsin mi?",
      description:
        "Yalnız satış bilgileri ve Türkçe çevirisi silinir. Villa kaydı, kiralık fiyatlar, takvim ve rezervasyonlar etkilenmez.",
      confirmLabel: "Sil",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingId(row.villa_id);
    try {
      const res = await adminFetch(
        `/api/admin/sale-listings/${encodeURIComponent(row.villa_id)}`,
        { method: "DELETE" }
      );
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData((prev) => prev.filter((x) => x.villa_id !== row.villa_id));
      toast.success("İlan silindi", { id: `sale-delete-${row.villa_id}` });
    } catch (err) {
      toast.error("İlan silinemedi", {
        id: `sale-delete-${row.villa_id}`,
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (data.length === 0) {
    return (
      <div className="card-premium p-10 text-center">
        <div className="w-11 h-11 rounded-full bg-[var(--color-sand-100)] flex items-center justify-center mx-auto">
          <Building2 size={16} className="text-[var(--color-champagne-700)]" />
        </div>
        <h3 className="font-display text-xl text-[var(--color-stone-900)] mt-4">
          Henüz satılık ilan yok
        </h3>
        <p className="text-sm text-[var(--color-stone-500)] mt-2">
          Önce mülkün ilan türünü “Satılık” yapın, ardından “Yeni İlan” ile satış bilgilerini ekleyin.
        </p>
      </div>
    );
  }

  const tabs: StatusFilter[] = ["all", "published", "draft", "unpublished"];

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3" role="tablist" aria-label="Yayın durumu">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={status === t}
            onClick={() => go({ status: t, page: 1 })}
            className={
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[12.5px] transition " +
              (status === t
                ? "bg-[var(--color-sand-50)] border-[var(--color-champagne-500)] text-[var(--color-stone-900)]"
                : "bg-white border-[var(--color-stone-100)] text-[var(--color-stone-600)] hover:border-[var(--color-stone-200)]")
            }
          >
            {t === "all" ? "Tümü" : PUBLICATION_STATUS_LABELS[t]}
            <span className="tabular-nums text-[var(--color-stone-400)]">{counts[t]}</span>
          </button>
        ))}
      </div>

      <div className="admin-filter-bar mb-3 flex flex-wrap items-center gap-3">
        <div className="admin-pill-search flex-1 min-w-[200px]">
          <Search size={14} className="text-[var(--admin-muted-2)]" />
          <input
            placeholder="Villa adı veya referans kodu ara…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (pageFromUrl > 1) go({ page: 1 });
            }}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-[12px] text-[var(--admin-muted-2)]">
          <span>Sayfa başına</span>
          <select
            value={pageSize}
            onChange={(e) => go({ pageSize: Number(e.target.value), page: 1 })}
            className="text-[12.5px] rounded-lg border border-[var(--admin-border)] bg-white px-2 py-1 text-[var(--admin-text)]"
          >
            {ALLOWED_PAGE_SIZES.map((sz) => (
              <option key={sz} value={sz}>
                {sz}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[12px] text-[var(--admin-muted-2)] px-2 tabular-nums">
          {totalItems > 0 ? `${rangeStart}-${rangeEnd} / ${totalItems}` : "0 / 0"} kayıt
        </span>
      </div>

      {pageItems.length === 0 ? (
        <div className="card-premium p-8 text-center text-sm text-[var(--color-stone-500)]">
          Bu filtreyle eşleşen ilan yok.
        </div>
      ) : (
        <div className="card-premium overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--color-stone-400)] border-b border-[var(--color-stone-100)]">
                <th className="px-5 py-3 font-semibold">Villa</th>
                <th className="px-3 py-3 font-semibold">Referans</th>
                <th className="px-3 py-3 font-semibold text-right">Satış fiyatı</th>
                <th className="px-3 py-3 font-semibold">Para birimi</th>
                <th className="px-3 py-3 font-semibold">Yayın</th>
                <th className="px-3 py-3 font-semibold">Oluşturulma</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-stone-100)]">
              {pageItems.map((r) => {
                const warn = villaWarning(r);
                return (
                  <tr key={r.villa_id} className="hover:bg-[var(--color-sand-50)]">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-[var(--color-stone-900)] flex items-center gap-1.5">
                        {r.is_featured && (
                          <Star size={12} className="text-[var(--color-champagne-600)] fill-current" aria-label="Öne çıkan" />
                        )}
                        {r.villa?.title || "—"}
                      </div>
                      {warn && <div className="text-[11px] text-amber-700 mt-0.5">{warn}</div>}
                    </td>
                    <td className="px-3 py-3.5 font-mono text-[12.5px] text-[var(--color-stone-700)]">
                      {r.reference_code || "—"}
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums">{priceLabel(r)}</td>
                    <td className="px-3 py-3.5">{r.sale_currency}</td>
                    <td className="px-3 py-3.5">
                      <span className={STATUS_BADGE[r.publication_status]}>
                        {PUBLICATION_STATUS_LABELS[r.publication_status]}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 tabular-nums text-[var(--color-stone-600)]">
                      {formatDateTr(r.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* 🛡️ Önizleme — her yayın durumunda (taslak / yayında /
                            kaldırılmış). Yetki kontrolü önizleme sayfasında. */}
                        <a
                          href={saleListingPreviewHref(r.villa_id)}
                          target="_blank"
                          rel="noopener"
                          aria-label={`${r.villa?.title || "İlan"} önizle`}
                          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-stone-700)] hover:text-[var(--color-stone-900)] px-3 py-1.5 rounded-lg border border-transparent hover:bg-white hover:border-[var(--color-champagne-300)]"
                        >
                          <Eye size={13} />
                          Önizle
                        </a>
                        <Link
                          href={`/maki-admin/sale-listings/${r.villa_id}`}
                          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-stone-700)] hover:text-[var(--color-stone-900)] px-3 py-1.5 rounded-lg border border-transparent hover:bg-white hover:border-[var(--color-champagne-300)]"
                        >
                          <Pencil size={13} />
                          Düzenle
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(r)}
                          disabled={deletingId === r.villa_id}
                          className="inline-flex items-center gap-1.5 text-[13px] text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-40"
                        >
                          <Trash2 size={13} />
                          {deletingId === r.villa_id ? "Siliniyor…" : "Sil"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Sayfa gezinme" className="flex items-center justify-center gap-1.5 pt-4">
          <button
            type="button"
            onClick={() => go({ page: page - 1 })}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12.5px] text-[var(--color-stone-600)] hover:bg-[var(--color-sand-50)] disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Önceki
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => go({ page: p })}
              aria-current={p === page ? "page" : undefined}
              className={
                "min-w-[32px] px-2.5 py-1.5 rounded-lg text-[12.5px] tabular-nums " +
                (p === page
                  ? "bg-[var(--color-champagne-600)] text-white"
                  : "text-[var(--color-stone-600)] hover:bg-[var(--color-sand-50)]")
              }
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => go({ page: page + 1 })}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12.5px] text-[var(--color-stone-600)] hover:bg-[var(--color-sand-50)] disabled:opacity-40"
          >
            Sonraki <ChevronRight size={14} />
          </button>
        </nav>
      )}
    </>
  );
}
