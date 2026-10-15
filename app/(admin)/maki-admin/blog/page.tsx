"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

import { adminFetch } from "@/lib/admin-fetch";
import { useNotify } from "@/app/components/admin/notifications/NotificationProvider";

/* ===============================================================
   🛡️ Blog — Liste (admin). GET /api/admin/blog (draft dahil).
   pages liste deseni; yalın. Düzenle / Sil + Yeni.
   =============================================================== */

type Row = {
  id: string;
  title: string;
  slug: string;
  is_active: boolean;
  /** Migration 099 — ana sayfa "Neden Kalkan?" (en fazla bir yazı). */
  show_on_homepage: boolean;
  published_at: string | null;
  category: string | null;
  created_at: string;
};

export default function BlogListPage() {
  const toast = useNotify();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [homepageBusyId, setHomepageBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await adminFetch("/api/admin/blog");
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: Row[];
      };
      if (res.ok && json.ok) setRows(json.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bu yazı silinsin mi? (kapak görseli de silinir)"))
      return;
    setDeletingId(id);
    try {
      const res = await adminFetch(`/api/admin/blog/${id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        toast.error("Silinemedi", {
          id: "blog-del",
          description: json.error,
        });
        return;
      }
      toast.success("Yazı silindi", { id: "blog-del" });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  /* 🏝️ "Ana sayfada göster" — PATCH /api/admin/blog/[id]. Ana sayfa TEK
     yazı gösterir: açılan yazı dışındakiler sunucuda kapatılır; liste de
     aynı şekilde güncellenir (düzenleme ekranı aynı kolonu okur). */
  const handleHomepageToggle = async (row: Row) => {
    const next = !row.show_on_homepage;
    setHomepageBusyId(row.id);
    try {
      const res = await adminFetch(`/api/admin/blog/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ show_on_homepage: next }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        toast.error("Ana sayfa ayarı kaydedilemedi", {
          id: "blog-homepage",
          description: json.error,
        });
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, show_on_homepage: next }
            : next
              ? { ...r, show_on_homepage: false }
              : r
        )
      );
      toast.success(
        next ? "Yazı ana sayfada gösterilecek" : "Yazı ana sayfadan kaldırıldı",
        { id: "blog-homepage" }
      );
    } finally {
      setHomepageBusyId(null);
    }
  };

  return (
    <div className="space-y-8 w-full">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">İçerik</p>
          <h1 className="font-display text-3xl md:text-4xl text-[var(--color-stone-900)] mt-2 tracking-[-0.02em]">
            Blog Yazıları
          </h1>
        </div>
        <Link href="/maki-admin/blog/new" className="btn-primary">
          <Plus size={15} />
          Yeni Yazı
        </Link>
      </div>

      <div className="card-premium p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-[var(--color-stone-500)]">
            <Loader2 size={16} className="animate-spin" />
            Yükleniyor…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-[var(--color-stone-500)]">
            Henüz blog yazısı yok. “Yeni Yazı” ile başlayın.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-stone-100)]">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-stone-50)] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[var(--color-stone-900)] truncate">
                    {r.title}
                  </p>
                  <p className="text-[12px] font-mono text-[var(--color-stone-400)] truncate">
                    /{r.slug}
                    {r.category ? ` · ${r.category}` : ""}
                  </p>
                </div>
                <span
                  className={`text-[11px] tracking-[0.08em] uppercase font-semibold px-2.5 py-1 rounded-full ${
                    r.is_active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-[var(--color-stone-100)] text-[var(--color-stone-500)]"
                  }`}
                >
                  {r.is_active ? "Yayında" : "Taslak"}
                </span>
                {/* 🏝️ Ana sayfada göster — taslakta açılamaz (kapatılabilir). */}
                <label
                  className={`flex shrink-0 items-center gap-2 text-[12px] text-[var(--color-stone-600)] ${
                    !r.is_active && !r.show_on_homepage
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                  title={
                    r.is_active
                      ? "Ana sayfadaki “Neden Kalkan?” bölümünde göster"
                      : "Yalnız yayındaki yazılar ana sayfada gösterilebilir"
                  }
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={r.show_on_homepage}
                    aria-label={`Ana sayfada göster: ${r.title}`}
                    data-homepage-toggle={r.id}
                    disabled={
                      homepageBusyId === r.id ||
                      (!r.is_active && !r.show_on_homepage)
                    }
                    onClick={() => handleHomepageToggle(r)}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed ${
                      r.show_on_homepage
                        ? "bg-[var(--admin-accent)]"
                        : "bg-[var(--color-stone-200)]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        r.show_on_homepage ? "translate-x-[18px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <span className="hidden sm:inline">Ana sayfada göster</span>
                </label>
                <Link
                  href={`/maki-admin/blog/${r.id}`}
                  className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-[var(--color-stone-200)] text-[var(--color-stone-700)] hover:bg-white"
                  aria-label="Düzenle"
                >
                  <Pencil size={15} />
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  disabled={deletingId === r.id}
                  className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-[var(--color-stone-200)] text-red-600 hover:bg-red-50 disabled:opacity-50"
                  aria-label="Sil"
                >
                  {deletingId === r.id ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Trash2 size={15} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
