/* ===============================================================
   🏝️ Admin blog — "Ana sayfada göster" (migration 099)
   API (POST/PATCH) + liste anahtarı + düzenleme formu senkronu.
   =============================================================== */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { revalidateTagMock } = vi.hoisted(() => ({ revalidateTagMock: vi.fn() }));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
  revalidateTag: (...a: unknown[]) => revalidateTagMock(...a),
  revalidatePath: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...r}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  /* eslint-disable-next-line @next/next/no-img-element */
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("@/lib/admin-route-auth", () => ({
  authorizeAdminCaller: async () => ({ ok: true, caller: { id: "admin-1" } }),
}));
vi.mock("@/lib/auth/action-authz", () => ({
  callerHasPermission: async () => true,
  FORBIDDEN_MESSAGE: "Yetkisiz",
}));
vi.mock("@/lib/storage/server", () => ({ removeServer: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/storage", () => ({ STORAGE_BUCKETS: { SITE_ASSETS: "site-assets" } }));

const { order, repo } = vi.hoisted(() => {
  const order: string[] = [];
  const repo = {
    listAll: vi.fn(),
    insert: vi.fn(async (p: Record<string, unknown>) => {
      order.push("insert");
      return { data: { id: "new-1", ...p }, error: null };
    }),
    findById: vi.fn(),
    findPublishedAt: vi.fn(async () => ({ data: { published_at: "x" }, error: null })),
    findPublishState: vi.fn(async () => ({
      data: { is_active: true, show_on_homepage: false } as {
        is_active: boolean;
        show_on_homepage: boolean;
      },
      error: null,
    })),
    clearHomepageExcept: vi.fn(async (id: string | null) => {
      order.push(`clear:${id}`);
      return { error: null };
    }),
    updateById: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      order.push(`update:${id}`);
      void patch;
      return { error: null };
    }),
    findCoverImage: vi.fn(),
    deleteById: vi.fn(),
  };
  return { order, repo };
});
vi.mock("@/lib/db/blog.repository.server", () => ({ blogServerRepository: repo }));

const { adminFetchMock } = vi.hoisted(() => ({ adminFetchMock: vi.fn() }));
vi.mock("@/lib/admin-fetch", () => ({ adminFetch: (...a: unknown[]) => adminFetchMock(...a) }));
vi.mock("@/app/components/admin/notifications/NotificationProvider", () => ({
  useNotify: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), loading: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock("@/app/components/admin/villa-form/RichTextEditor", () => ({ default: () => null }));
vi.mock("@/lib/storage/use-site-asset-versions", () => ({
  useSiteAssetVersions: () => ({ versions: {}, refresh: vi.fn(), url: (u: string) => u }),
}));

import { POST } from "@/app/api/admin/blog/route";
import { PATCH } from "@/app/api/admin/blog/[id]/route";
import BlogListPage from "@/app/(admin)/maki-admin/blog/page";
import BlogPostForm from "@/app/(admin)/maki-admin/blog/BlogPostForm";
import { BLOG_HOMEPAGE_TAG } from "@/lib/blog-homepage.server";
import { HOMEPAGE_REQUIRES_ACTIVE } from "@/lib/blog-homepage";

const req = (body: unknown) =>
  new Request("http://x/api/admin/blog", { method: "POST", body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  order.length = 0;
  vi.clearAllMocks();
});

describe("PATCH /api/admin/blog/[id] — show_on_homepage", () => {
  it("açınca: önce diğer işaretler kaldırılır, sonra bu yazı işaretlenir; ana sayfa cache'i temizlenir", async () => {
    const res = await PATCH(req({ show_on_homepage: true }), params("p2"));
    expect(res.status).toBe(200);
    expect(order).toEqual(["clear:p2", "update:p2"]);
    expect(repo.updateById.mock.calls[0][1]).toMatchObject({ show_on_homepage: true });
    expect(revalidateTagMock).toHaveBeenCalledWith(BLOG_HOMEPAGE_TAG, { expire: 0 });
  });

  it("kapatınca: yalnız bu yazı false, başkasına dokunulmaz", async () => {
    const res = await PATCH(req({ show_on_homepage: false }), params("p2"));
    expect(res.status).toBe(200);
    expect(repo.clearHomepageExcept).not.toHaveBeenCalled();
    expect(repo.updateById.mock.calls[0][1]).toMatchObject({ show_on_homepage: false });
  });

  it("taslak yazı ana sayfaya alınamaz (400), hiçbir şey yazılmaz", async () => {
    repo.findPublishState.mockResolvedValueOnce({
      data: { is_active: false, show_on_homepage: false },
      error: null,
    });
    const res = await PATCH(req({ show_on_homepage: true }), params("p3"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(HOMEPAGE_REQUIRES_ACTIVE);
    expect(repo.updateById).not.toHaveBeenCalled();
    expect(repo.clearHomepageExcept).not.toHaveBeenCalled();
  });

  it("aynı istekte yayına alınırsa işaretlenebilir", async () => {
    repo.findPublishState.mockResolvedValueOnce({
      data: { is_active: false, show_on_homepage: false },
      error: null,
    });
    const res = await PATCH(req({ is_active: true, show_on_homepage: true }), params("p4"));
    expect(res.status).toBe(200);
    expect(repo.updateById.mock.calls[0][1]).toMatchObject({
      is_active: true,
      show_on_homepage: true,
    });
  });

  it("yayından kaldırılan yazının ana sayfa işareti de kalkar", async () => {
    await PATCH(req({ is_active: false, show_on_homepage: true }), params("p5"));
    expect(repo.updateById.mock.calls[0][1]).toMatchObject({
      is_active: false,
      show_on_homepage: false,
    });
    expect(repo.clearHomepageExcept).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/blog — show_on_homepage", () => {
  it("yayında + işaretli: önce tüm işaretler kaldırılır, kayıt işaretli eklenir", async () => {
    const res = await POST(req({ title: "T", slug: "t", is_active: true, show_on_homepage: true }));
    expect(res.status).toBe(200);
    expect(order).toEqual(["clear:null", "insert"]);
    expect(repo.insert.mock.calls[0][0]).toMatchObject({ show_on_homepage: true });
    expect(revalidateTagMock).toHaveBeenCalledWith(BLOG_HOMEPAGE_TAG, { expire: 0 });
  });

  it("taslak + işaretli → 400", async () => {
    const res = await POST(req({ title: "T", slug: "t", is_active: false, show_on_homepage: true }));
    expect(res.status).toBe(400);
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it("işaretsiz → false", async () => {
    await POST(req({ title: "T", slug: "t", is_active: true }));
    expect(repo.insert.mock.calls[0][0]).toMatchObject({ show_on_homepage: false });
  });
});

/* ---------------- Admin liste anahtarı ---------------- */
const ROWS = [
  { id: "a", title: "A", slug: "a", is_active: true, show_on_homepage: true, published_at: null, category: null, created_at: "" },
  { id: "b", title: "B", slug: "b", is_active: true, show_on_homepage: false, published_at: null, category: null, created_at: "" },
  { id: "c", title: "C", slug: "c", is_active: false, show_on_homepage: false, published_at: null, category: null, created_at: "" },
];
const json = (body: unknown, ok = true) => ({ ok, json: async () => body });

describe("Admin blog listesi — 'Ana sayfada göster' anahtarı", () => {
  it("DB değerini gösterir; taslakta açılamaz", async () => {
    adminFetchMock.mockResolvedValueOnce(json({ ok: true, data: ROWS }));
    render(<BlogListPage />);
    const a = await screen.findByRole("switch", { name: "Ana sayfada göster: A" });
    expect(a).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Ana sayfada göster: B" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("switch", { name: "Ana sayfada göster: C" })).toBeDisabled();
  });

  it("B açılınca PATCH gönderilir; A kapanır, B açılır (tek yazı)", async () => {
    adminFetchMock
      .mockResolvedValueOnce(json({ ok: true, data: ROWS }))
      .mockResolvedValueOnce(json({ ok: true }));
    render(<BlogListPage />);
    fireEvent.click(await screen.findByRole("switch", { name: "Ana sayfada göster: B" }));
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Ana sayfada göster: B" })).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
    expect(screen.getByRole("switch", { name: "Ana sayfada göster: A" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    const [url, init] = adminFetchMock.mock.calls[1];
    expect(url).toBe("/api/admin/blog/b");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ show_on_homepage: true });
  });

  it("hata olursa durum değişmez", async () => {
    adminFetchMock
      .mockResolvedValueOnce(json({ ok: true, data: ROWS }))
      .mockResolvedValueOnce(json({ ok: false, error: "x" }, false));
    render(<BlogListPage />);
    fireEvent.click(await screen.findByRole("switch", { name: "Ana sayfada göster: A" }));
    await waitFor(() => expect(adminFetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("switch", { name: "Ana sayfada göster: A" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

describe("Blog düzenleme formu — aynı alan", () => {
  it("DB değeriyle açılır ve kaydette show_on_homepage gönderilir", async () => {
    adminFetchMock.mockResolvedValueOnce(json({ ok: true }));
    render(
      <BlogPostForm
        mode="edit"
        initial={{ id: "a", title: "A", slug: "a", is_active: true, show_on_homepage: true }}
      />,
    );
    const box = screen.getByRole("checkbox", { name: /Ana sayfada göster/ });
    expect(box).toBeChecked();
    fireEvent.click(box);
    fireEvent.click(box);
    fireEvent.submit(box.closest("form")!);
    await waitFor(() => expect(adminFetchMock).toHaveBeenCalled());
    const body = JSON.parse(adminFetchMock.mock.calls[0][1].body);
    expect(body.show_on_homepage).toBe(true);
  });

  it("taslakta devre dışı ve false gönderilir", async () => {
    adminFetchMock.mockResolvedValueOnce(json({ ok: true }));
    render(
      <BlogPostForm
        mode="edit"
        initial={{ id: "c", title: "C", slug: "c", is_active: false, show_on_homepage: false }}
      />,
    );
    const box = screen.getByRole("checkbox", { name: /Ana sayfada göster/ });
    expect(box).toBeDisabled();
    fireEvent.submit(box.closest("form")!);
    await waitFor(() => expect(adminFetchMock).toHaveBeenCalled());
    expect(JSON.parse(adminFetchMock.mock.calls[0][1].body).show_on_homepage).toBe(false);
  });
});
