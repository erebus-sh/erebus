import type { Metadata } from "next";
import {
  isBlogRootPage,
  isSeriesPage,
  isCategoryPage,
  isPaginatedBlogPage,
  isPaginatedCategoryPage,
  getSeriesSlug,
  getCategorySlug,
  getPageNumber,
} from "./page-type";

export interface OGImageMetadata {
  /**
   * Title for the OG image
   */
  title: string;

  /**
   * Optional description for the OG image
   */
  description?: string;
}

export interface OGImageGeneratorConfig {
  /**
   * Blog constants from the application
   */
  blogConstants: {
    blogTitle: string;
    paginationTitle: (page: number) => string;
    categoryPaginationTitle: (category: string, page: number) => string;
  };

  /**
   * Function to get category information by slug
   */
  getCategoryBySlug: (slug: string) => { label: string; description?: string };

  /**
   * Function to get series information by slug
   */
  getSeriesBySlug: (slug: string) => { label: string; description?: string };

  /**
   * Blog source to get post data
   */
  blogSource: any;
}

/**
 * Process URL parameters by removing image.png from the slug
 */
export function processImageParams(params: { slug?: string[] }) {
  return {
    slug: params.slug?.filter((s) => s !== "image.png"),
  };
}

/**
 * Generate OG image metadata based on URL parameters
 */
export function generateOGImageMetadata(
  params: { slug?: string[] },
  config: OGImageGeneratorConfig,
): OGImageMetadata {
  const processedParams = processImageParams(params);
  const { blogConstants, getCategoryBySlug, getSeriesBySlug, blogSource } =
    config;

  // Blog root page
  if (isBlogRootPage(processedParams)) {
    return {
      title: blogConstants.blogTitle,
    };
  }

  // Series page
  if (isSeriesPage(processedParams)) {
    const seriesSlug = getSeriesSlug(processedParams);
    if (seriesSlug) {
      const series = getSeriesBySlug(seriesSlug);
      if (series) {
        return {
          title: series.label,
          description: series.description,
        };
      }
    }
  }

  // Category page
  if (isCategoryPage(processedParams)) {
    const categorySlug = getCategorySlug(processedParams);
    if (categorySlug) {
      const categoryInfo = getCategoryBySlug(categorySlug);
      if (categoryInfo) {
        return {
          title: categoryInfo.label,
          description: categoryInfo.description,
        };
      }
    }
  }

  // Paginated blog page
  if (isPaginatedBlogPage(processedParams)) {
    const pageNumber = getPageNumber(processedParams);
    return {
      title: blogConstants.paginationTitle(pageNumber),
    };
  }

  // Paginated category page
  if (isPaginatedCategoryPage(processedParams)) {
    const categorySlug = processedParams.slug?.[0] || "";
    const pageNumber = getPageNumber(processedParams);
    const categoryInfo = getCategoryBySlug(categorySlug);

    if (categoryInfo) {
      return {
        title: blogConstants.categoryPaginationTitle(categorySlug, pageNumber),
        description: categoryInfo.description,
      };
    }
  }

  // Single post page (default case for any other URL pattern)
  if (processedParams.slug && processedParams.slug.length > 0) {
    const post = blogSource.getPage(processedParams.slug);
    if (post && post.data && post.data.title) {
      return {
        title: post.data.title,
        description: post.data.description,
      };
    }
  }

  // Default fallback
  return {
    title: blogConstants.blogTitle,
  };
}
