import "server-only";

import { unstable_cache } from "next/cache";

import { blogRepository, type BlogPost } from "@/lib/db/blog.repository";
import { resolveBlogContent } from "@/lib/i18n/get-blog-translation.server";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { localeHref } from "@/lib/i18n/locale-href";
import { resolveAssetUrl } from "@/lib/storage.helpers";
import { versionedAssetUrl } from "@/lib/storage/site-asset-version";
import { getSiteAssetVersions } from "@/lib/storage/site-asset-version.server";
import { bodyHighlights, bodySummary, htmlToText, truncateText } from "@/lib/blog-homepage";

/* ===============================================================
   🏝️ Ana sayfa "Neden Kalkan?" — blog verisi (cache'li)
   ===============================================================
   Kaynak: MEVCUT blog_posts (migration 058) + "Ana sayfada göster"
   (migration 099). Yalnız YAYINDAKİ (is_active) işaretli yazı.
   Çeviri: MEVCUT blog_post_translations katmanı (TR'de sorgu yok).
   Cache: unstable_cache, tag BLOG_HOMEPAGE_TAG — admin blog
   oluşturma/güncelleme/silme ve çeviri kaydı sonrası temizlenir.
   Hata → null (bölüm render edilmez; ana sayfa bozulmaz).
   =============================================================== */

export const BLOG_HOMEPAGE_TAG = "blog-homepage";

export type HomepageBlogFeature = {
  slug: string;
  href: string;
  title: string;
  category: string | null;
  lead: string | null;
  summary: string | null;
  highlights: string[];
  coverUrl: string | null;
};

export async function buildHomepageBlogFeature(
  post: BlogPost | null,
  locale: Locale,
): Promise<HomepageBlogFeature | null> {
  if (!post || !post.is_active || !post.show_on_homepage || !post.slug) return null;

  const content = await resolveBlogContent(post, locale);
  const title = (content.title || post.title || "").trim();
  if (!title) return null;

  const excerpt = content.excerpt ? htmlToText(content.excerpt) : "";
  const summary = bodySummary(content.body, 360);
  /* Özet (excerpt) varsa öncü metin odur; gövde özeti ek paragraf olur.
     Excerpt yoksa gövde özeti öncü metne geçer (tekrar basılmaz). */
  const lead = excerpt ? truncateText(excerpt, 260) : summary || null;
  const rest = excerpt && summary && summary !== lead ? summary : null;

  const versions = await getSiteAssetVersions([post.cover_image]);
  const coverUrl = versionedAssetUrl(
    resolveAssetUrl(post.cover_image),
    versions,
    post.cover_image,
  );

  return {
    slug: post.slug,
    href: localeHref(`/blog/${post.slug}`, locale),
    title,
    category: post.category?.trim() || null,
    lead,
    summary: rest,
    highlights: bodyHighlights(content.body, 4),
    coverUrl: coverUrl || null,
  };
}

export const getCachedHomepageBlogFeature = unstable_cache(
  async (locale: Locale = DEFAULT_LOCALE): Promise<HomepageBlogFeature | null> => {
    try {
      const { data, error } = await blogRepository.findHomepageFeatured();
      if (error) {
        console.error("[blog.homepage] FAILED", error.message);
        return null;
      }
      return await buildHomepageBlogFeature((data as BlogPost | null) ?? null, locale);
    } catch (e) {
      console.error("[blog.homepage] FAILED", e instanceof Error ? e.message : e);
      return null;
    }
  },
  ["blog-homepage:feature"],
  { tags: [BLOG_HOMEPAGE_TAG], revalidate: 600 },
);
