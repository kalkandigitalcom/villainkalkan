/* Yeni satılık ilan sayfası (/maki-admin/sale-listings/ekle) — hangi
   ekranın gösterileceği (saf; test edilir). 108: iki oluşturma yöntemi. */
export type CreateKind = "choose" | "villa" | "standalone";

export function resolveCreateKind(params: { kaynak?: string | null; villa?: string | null }): CreateKind {
  const k = (params.kaynak || "").trim();
  if (k === "bagimsiz") return "standalone";
  if (k === "villa" || (params.villa || "").trim()) return "villa";
  return "choose";
}
