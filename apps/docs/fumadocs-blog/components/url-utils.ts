import { BlogConfig } from "./types";

/**
 * Configuration for URL utilities
 */
export interface UrlConfig {
  blogBase: string;
  blogOgImageBase?: string;
}

/**
 * Utility functions for generating blog URLs based on the blog configuration
 */
export class UrlUtils {
  private blogBase: string;
  private blogOgImageBase: string;

  constructor(config: UrlConfig) {
    this.blogBase = config.blogBase;
    // Default to blogBase-og if blogOgImageBase is not provided
    this.blogOgImageBase =
      config.blogOgImageBase || `${config.blogBase.replace(/^\//, "")}-og`;
  }

  /**
   * Get the base blog URL
   */
  getBlogUrl(): string {
    return this.blogBase;
  }

  /**
   * Get the URL for a specific blog post
   */
  getPostUrl(slugs: string[]): string {
    return `${this.blogBase}/${slugs.join("/")}`;
  }

  /**
   * Get the URL for a specific blog post (single slug version)
   */
  getBlogPostUrl(slug: string): string {
    return `${this.blogBase}/${slug}`;
  }

  /**
   * Get the URL for a specific series
   */
  getSeriesUrl(seriesSlug: string): string {
    return `${this.blogBase}/series/${seriesSlug}`;
  }

  /**
   * Get the URL for a specific category
   */
  getCategoryUrl(category: string): string {
    return `${this.blogBase}/${category}`;
  }

  /**
   * Get the URL for a paginated blog page
   */
  getPaginatedBlogUrl(page: number): string {
    return `${this.blogBase}/page/${page}`;
  }

  /**
   * Get the URL for a paginated category page
   */
  getPaginatedCategoryUrl(category: string, page: number): string {
    return `${this.blogBase}/${category}/page/${page}`;
  }

  /**
   * Get the URL for the blog OG image
   */
  getBlogOgImageUrl(): string {
    return `/${this.blogOgImageBase}/image.png`;
  }

  /**
   * Get the URL for a category OG image
   */
  getCategoryOgImageUrl(category: string): string {
    return `/${this.blogOgImageBase}/${category}/image.png`;
  }

  /**
   * Get the URL for a series OG image
   */
  getSeriesOgImageUrl(series: string): string {
    return `/${this.blogOgImageBase}/series/${series}/image.png`;
  }

  /**
   * Get the URL for a blog post OG image
   */
  getBlogPostOgImageUrl(slugs: string[]): string {
    return `/${this.blogOgImageBase}/${slugs.join("/")}/image.png`;
  }
}

/**
 * Create a URL utils instance from a URL configuration
 */
export function createUrlUtils(config: UrlConfig): UrlUtils {
  return new UrlUtils(config);
}
