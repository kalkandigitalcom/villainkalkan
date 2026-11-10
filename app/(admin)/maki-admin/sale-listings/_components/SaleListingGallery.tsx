"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from "lucide-react";

import { adminFetch } from "@/lib/admin-fetch";
import {
  useConfirm,
  useNotify,
} from "@/app/components/admin/notifications/NotificationProvider";
import type { SaleListingImageLite } from "./types";

/* ===============================================================
   🛡️ BAĞIMSIZ GAYRİMENKUL — FOTOĞRAF GALERİSİ (admin, 108)
   ===============================================================
   Villa galerisiyle aynı yükleme deseni (tarayıcıda WebP + 1600px,
   imzalı PUT ile doğrudan R2) ama YALNIZ satılık ilan API'leri:
     POST  /api/admin/sale-listings/[id]/images/upload-url
     POST  /api/admin/sale-listings/[id]/images        { key }
     PATCH /api/admin/sale-listings/[id]/images        { coverId } | { order }
     DELETE /api/admin/sale-listings/[id]/images/[imageId]
   Villa galerisi (AdminGallery / villa_images) KULLANILMAZ.
   =============================================================== */

const MAX_INPUT_BYTES = 15 * 1024 * 1024;

async function convertToWebP(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context alınamadı");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("WebP dönüşümü başarısız"))),
      "image/webp",
      0.8
    );
  });
}

/** Saf — bir fotoğrafı yukarı/aşağı taşıyıp yeni id sırasını döndürür. */
export function moveImage(ids: string[], id: string, dir: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export default function SaleListingGallery({ listingId }: { listingId: string }) {
  const toast = useNotify();
  /* useNotify her render'da yeni nesne döndürür → yükleme efektinin
     bağımlılığına girmesin (sonsuz yeniden yükleme olmasın). */
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  });
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<SaleListingImageLite[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const base = `/api/admin/sale-listings/${encodeURIComponent(listingId)}/images`;

  useEffect(() => {
    let cancelled = false;
    adminFetch(base)
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; images?: SaleListingImageLite[]; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
        if (!cancelled) setImages(json.images || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setImages([]);
        toastRef.current.error("Fotoğraflar yüklenemedi", {
          id: "sale-gallery-load",
          description: err instanceof Error ? err.message : undefined,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [base, reloadKey]);

  const load = () => setReloadKey((k) => k + 1);

  async function uploadOne(file: File): Promise<boolean> {
    if (!file.type.startsWith("image/") || file.size > MAX_INPUT_BYTES) return false;
    const blob = await convertToWebP(file);
    const ticketRes = await adminFetch(`${base}/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ size: blob.size, contentType: "image/webp" }),
    });
    const ticket = (await ticketRes.json().catch(() => ({}))) as {
      ok?: boolean;
      uploadUrl?: string;
      key?: string;
      contentType?: string;
      error?: string;
    };
    if (!ticketRes.ok || !ticket.ok || !ticket.uploadUrl || !ticket.key) {
      throw new Error(ticket.error || `HTTP ${ticketRes.status}`);
    }
    const put = await fetch(ticket.uploadUrl, {
      method: "PUT",
      body: blob,
      headers: { "Content-Type": ticket.contentType || "image/webp" },
    });
    if (!put.ok) throw new Error(`Yükleme başarısız (HTTP ${put.status})`);
    const reg = await adminFetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: ticket.key }),
    });
    const regJson = (await reg.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!reg.ok || !regJson.ok) throw new Error(regJson.error || `HTTP ${reg.status}`);
    return true;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || busy) return;
    setBusy(true);
    let ok = 0;
    let failed = 0;
    for (const f of Array.from(files)) {
      try {
        if (await uploadOne(f)) ok += 1;
        else failed += 1;
      } catch (err) {
        failed += 1;
        console.error("[sale-gallery] upload FAILED", err);
      }
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (ok > 0) toast.success(`${ok} fotoğraf yüklendi`, { id: "sale-gallery-upload" });
    if (failed > 0) toast.error(`${failed} fotoğraf yüklenemedi`, { id: "sale-gallery-upload-fail" });
    load();
  }

  async function patch(body: Record<string, unknown>, errorText: string) {
    setBusy(true);
    try {
      const res = await adminFetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
    } catch (err) {
      toast.error(errorText, { id: "sale-gallery-patch", description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
      load();
    }
  }

  async function handleDelete(img: SaleListingImageLite) {
    const proceed = await confirm({
      title: "Fotoğraf silinsin mi?",
      description: "Fotoğraf kalıcı olarak silinir.",
      confirmLabel: "Sil",
      variant: "danger",
    });
    if (!proceed) return;
    setBusy(true);
    try {
      const res = await adminFetch(`${base}/${encodeURIComponent(img.id)}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast.success("Fotoğraf silindi", { id: "sale-gallery-delete" });
    } catch (err) {
      toast.error("Fotoğraf silinemedi", { id: "sale-gallery-delete", description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
      load();
    }
  }

  const ids = (images || []).map((i) => i.id);

  return (
    <div className="space-y-4" data-sale-gallery>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost" onClick={() => inputRef.current?.click()} disabled={busy}>
          <ImagePlus size={15} />
          {busy ? "İşleniyor…" : "Fotoğraf yükle"}
        </button>
        <span className="text-[12px] text-[var(--color-stone-400)]">
          Çoklu seçim desteklenir. Görseller WebP biçimine dönüştürülür (en fazla 1600px).
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-label="Fotoğraf seç"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {images === null ? (
        <p className="text-sm text-[var(--color-stone-500)]">Yükleniyor…</p>
      ) : images.length === 0 ? (
        <p className="text-sm text-[var(--color-stone-500)]">Henüz fotoğraf yok. İlk yüklenen fotoğraf kapak olur.</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img, i) => (
            <li key={img.id} className="rounded-[14px] overflow-hidden border border-[var(--color-stone-100)] bg-white" data-sale-gallery-item>
              <div className="relative aspect-[4/3] bg-[var(--color-sand-100)]">
                {img.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                )}
                {img.is_cover && (
                  <span className="absolute top-2 left-2 admin-badge admin-badge--confirmed">Kapak</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 px-2 py-2">
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Yukarı taşı" disabled={busy || i === 0}
                    onClick={() => void patch({ order: moveImage(ids, img.id, -1) }, "Sıralama kaydedilemedi")}
                    className="p-1.5 rounded-lg hover:bg-[var(--color-sand-50)] disabled:opacity-30">
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" aria-label="Aşağı taşı" disabled={busy || i === images.length - 1}
                    onClick={() => void patch({ order: moveImage(ids, img.id, 1) }, "Sıralama kaydedilemedi")}
                    className="p-1.5 rounded-lg hover:bg-[var(--color-sand-50)] disabled:opacity-30">
                    <ArrowDown size={14} />
                  </button>
                  {!img.is_cover && (
                    <button type="button" aria-label="Kapak yap" disabled={busy}
                      onClick={() => void patch({ coverId: img.id }, "Kapak güncellenemedi")}
                      className="p-1.5 rounded-lg hover:bg-[var(--color-sand-50)] disabled:opacity-30">
                      <Star size={14} />
                    </button>
                  )}
                </div>
                <button type="button" aria-label="Fotoğrafı sil" disabled={busy}
                  onClick={() => void handleDelete(img)}
                  className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-30">
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
