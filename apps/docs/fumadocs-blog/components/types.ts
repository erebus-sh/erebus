import React from "react";
import type { Metadata } from "next";

/**
 * Configuration for blog URLs and paths
 */
export interface BlogConfig {
  /**
   * Base URL for the blog (e.g., "/blog")
   */
  blogBase: string;

  /**
   * Base URL for blog OG images (e.g., "blog-og")
   * If not provided, defaults to blogBase-og
   */
  blogOgImageBase?: string;

  /**
   * Number of posts to display per page
   */
  pageSize: number;
}

// Define a type for blog posts that matches the structure used in the app
export type BlogPost = {
  slugs?: string[];
  data: {
    date: Date;
    tags?: string[];
    series?: string;
    seriesPart?: number;
    [key: string]: any;
  };
  [key: string]: any;
};

export interface BlogConstants {
  blogTitle: string;
  blogDescription: string;
  siteName: string;
  siteUrl?: string;
  defaultAuthorName: string;
  author?: { name: string; url: string };
  creator?: string;
  xUsername: string;
  paginationTitle: (page: number) => string;
  paginationDescription: (page: number) => string;
  categoryPaginationTitle: (category: string, page: number) => string;
  categoryPaginationDescription: (category: string, page: number) => string;
  blogBase: string;
  blogOgImageBase: string;
  pageSize: number;
}

export interface PostCardProps {
  post: NonNullable<BlogPost>;
  configuration?: BlogConfiguration;
}

// Define BlogConfiguration as an interface that extends Record<string, any>
export interface BlogConfiguration extends Record<string, any> {
  GridBackground?: React.ComponentType<{ maxWidthClass?: string }>;
  PostCard?: React.ComponentType<PostCardProps>;
  Button?: React.ComponentType<any>;
  Popover?: React.ComponentType<any>;
  PopoverContent?: React.ComponentType<any>;
  PopoverTrigger?: React.ComponentType<any>;
  Badge?: React.ComponentType<any>;
  Book?: React.ComponentType<any>;
  Card?: React.ComponentType<any>;
  cn?: (...inputs: any[]) => string;
  backgroundPattern?: {
    enabled: boolean;
    component: React.ReactNode;
  };

  /**
   * Blog configuration for URLs and pagination
   */
  config: BlogConfig;
}

export interface MetadataImageResult {
  getImageMeta: (slugs: string[]) => { alt: string; url: string };
  withImage: (slugs: string[], metadata?: Metadata) => Metadata;
  generateParams: () => { slug: string[] }[];
  createAPI: (handler: any) => any;
}
