import type { loader } from "fumadocs-core/source";
import { notFound } from "next/navigation";
import { BlogList, CategoryBlogList } from "./blog-list";
import { SinglePost } from "./single-post";
import { SeriesList } from "./series-list";
import {
  isBlogRootPage,
  isSeriesPage,
  isCategoryPage,
  isPaginatedBlogPage,
  isPaginatedCategoryPage,
  isSinglePostPage,
  getSeriesSlug,
  getCategorySlug,
  getPageNumber,
} from "./page-type";
import { type BlogConfiguration } from "./types";
import { getSortedByDatePosts } from "./utils";

interface BlogWrapperProps {
  params: { slug?: string[] };
  blogSource: ReturnType<typeof loader>;
  posts: any[];
  configuration: BlogConfiguration;
  getCategoryBySlug: (slug: string) => any;
  getSeriesBySlug: (slug: string) => any;
  mdxComponents: any;
  includeDrafts: boolean;
}

export async function BlogWrapper({
  params,
  blogSource,
  posts,
  configuration,
  getCategoryBySlug,
  getSeriesBySlug,
  mdxComponents,
  includeDrafts,
}: BlogWrapperProps) {
  const sortedPosts = getSortedByDatePosts(posts, includeDrafts);

  // Handle blog root page
  if (isBlogRootPage(params)) {
    return (
      <BlogList page={1} configuration={configuration} posts={sortedPosts} />
    );
  }

  // Handle series page
  if (isSeriesPage(params)) {
    const seriesSlug = getSeriesSlug(params)!;
    return (
      <SeriesList
        seriesSlug={seriesSlug}
        configuration={configuration}
        posts={sortedPosts}
        getSeriesBySlug={getSeriesBySlug}
      />
    );
  }

  // Handle category page
  if (isCategoryPage(params)) {
    const category = getCategorySlug(params);
    return (
      <CategoryBlogList
        category={category}
        configuration={configuration}
        posts={sortedPosts}
        getCategoryBySlug={getCategoryBySlug}
      />
    );
  }

  // Handle paginated blog page
  if (isPaginatedBlogPage(params)) {
    return (
      <BlogList
        page={getPageNumber(params)}
        configuration={configuration}
        posts={sortedPosts}
      />
    );
  }

  // Handle paginated category page
  if (isPaginatedCategoryPage(params)) {
    const category = params.slug?.[0];

    if (!category) {
      return notFound();
    }

    return (
      <CategoryBlogList
        category={category}
        page={getPageNumber(params)}
        configuration={configuration}
        posts={sortedPosts}
        getCategoryBySlug={getCategoryBySlug}
      />
    );
  }

  // Handle blog post page
  if (isSinglePostPage(params)) {
    const page = blogSource.getPage(params.slug);
    const category = params.slug?.[0] || undefined;

    if (!page) notFound();

    const lastModified = page?.data.date;
    const lastUpdate = lastModified ? new Date(lastModified) : undefined;
    const tags = page?.data.tags ?? [];

    return (
      <SinglePost
        page={page}
        category={category}
        lastUpdate={lastUpdate}
        tags={tags}
        configuration={configuration}
        getCategoryBySlug={getCategoryBySlug}
        mdxComponents={mdxComponents}
        posts={sortedPosts}
      />
    );
  }
}
