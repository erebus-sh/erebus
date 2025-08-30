/**
 * Helper functions to determine page types based on URL parameters
 */

/**
 * Checks if the current route is the blog root page
 */
export function isBlogRootPage(params: { slug?: string[] }): boolean {
  return !params.slug || params.slug.length === 0;
}

/**
 * Checks if the current route is a series page
 */
export function isSeriesPage(params: { slug?: string[] }): boolean {
  return (
    !!params.slug &&
    params.slug.length >= 2 &&
    params.slug[0] === "series" &&
    !!params.slug[1]
  );
}

/**
 * Checks if the current route is a category page
 */
export function isCategoryPage(params: { slug?: string[] }): boolean {
  return !params.slug || params.slug.length === 1;
}

/**
 * Checks if the current route is a paginated blog list
 */
export function isPaginatedBlogPage(params: { slug?: string[] }): boolean {
  return (
    !!params.slug &&
    params.slug.length === 2 &&
    params.slug[0] === "page" &&
    !isNaN(Number(params.slug[1]))
  );
}

/**
 * Checks if the current route is a paginated category page
 */
export function isPaginatedCategoryPage(params: { slug?: string[] }): boolean {
  return (
    !!params.slug &&
    params.slug.length === 3 &&
    params.slug[1] === "page" &&
    !isNaN(Number(params.slug[2]))
  );
}

/**
 * Checks if the current route is a blog post page
 */
export function isSinglePostPage(params: { slug?: string[] }): boolean {
  return (
    !!params.slug &&
    params.slug.length === 2 &&
    params.slug[0] !== "page" &&
    params.slug[0] !== "series"
  );
}

/**
 * Gets the series slug from params if it's a series page
 */
export function getSeriesSlug(params: { slug?: string[] }): string | null {
  if (
    isSeriesPage(params) &&
    params.slug &&
    params.slug.length > 1 &&
    params.slug[1]
  ) {
    return params.slug[1];
  }
  return null;
}

/**
 * Gets the category slug from params if it's a category page
 */
export function getCategorySlug(params: { slug?: string[] }): string {
  if (
    isCategoryPage(params) &&
    params.slug &&
    params.slug.length > 0 &&
    params.slug[0]
  ) {
    return params.slug[0];
  }
  return "";
}

/**
 * Gets the page number from params if it's a paginated page
 */
export function getPageNumber(params: { slug?: string[] }): number {
  if (isPaginatedBlogPage(params) && params.slug && params.slug.length > 1) {
    return Number(params.slug[1]);
  }
  if (
    isPaginatedCategoryPage(params) &&
    params.slug &&
    params.slug.length > 2
  ) {
    return Number(params.slug[2]);
  }
  return 1;
}
