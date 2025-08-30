import type { Metadata } from "next/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Book } from "@/components/ui/book";
import { Card } from "@/components/ui/card";
import type { BlogConstants, BlogConfiguration } from "@/fumadocs-blog";
import { PostCard } from "@/fumadocs-blog";
import { Brain, Book as LucideBook, Megaphone, BookIcon } from "lucide-react";

// Blog text constants that can be customized

export const blogConstants: BlogConstants = {
  // General
  blogTitle: "Blog",
  blogDescription: "Articles and thoughts",
  siteName: "myblog.com",
  defaultAuthorName: "My Name",
  xUsername: "@my_x_username",
  // Pagination
  paginationTitle: (page: number) => `Blog - Page ${page}`,
  paginationDescription: (page: number) =>
    `Articles and thoughts - Page ${page}`,
  categoryPaginationTitle: (category: string, page: number) =>
    `${category.charAt(0).toUpperCase() + category.slice(1)} - Page ${page}`,
  categoryPaginationDescription: (category: string, page: number) =>
    `Articles in the ${category} category - Page ${page}`,
  // URLs
  blogBase: "/blog",
  blogOgImageBase: "blog-og",
  pageSize: 5,
};

export function createBlogMetadata(
  override: Metadata,
  blogConstants: BlogConstants,
): Metadata {
  // Derive values from the core properties
  const siteUrl = `https://${blogConstants.siteName}`;
  const author = {
    name: blogConstants.defaultAuthorName,
    url: siteUrl,
  };
  const creator = blogConstants.defaultAuthorName;

  return {
    ...override,
    authors: [author],
    creator: creator,
    openGraph: {
      title: override.title ?? undefined,
      description: override.description ?? undefined,
      url: siteUrl,
      siteName: blogConstants.siteName,
      ...override.openGraph,
    },
    twitter: {
      card: "summary_large_image",
      site: blogConstants.xUsername,
      creator: blogConstants.xUsername,
      title: override.title ?? undefined,
      description: override.description ?? undefined,
      ...override.twitter,
    },
    alternates: {
      canonical: "/",
      types: {
        "application/rss+xml": "/api/rss.xml",
      },
      ...override.alternates,
    },
  };
}

export function getBlogConfiguration(): BlogConfiguration {
  return {
    PostCard: PostCard,
    Button,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Badge,
    Book,
    Card,
    cn,
    config: {
      blogBase: blogConstants.blogBase,
      blogOgImageBase: blogConstants.blogOgImageBase,
      pageSize: 5,
    },
  };
}

export const useBlogConfiguration = getBlogConfiguration;

// Moved from lib/categories.ts
export const getCategoryBySlug = (slug: string) => {
  const categories = {
    idea: {
      label: "Idea",
      icon: Brain,
      description:
        "Exploratory thoughts and wild concepts for Teurons and beyond.",
    },
    opinions: {
      label: "Opinions",
      icon: Megaphone,
      description:
        "Subjective, wild, gut-hunch takes—less informed, out-of-box rants.",
    },
  };

  return (
    categories[slug as keyof typeof categories] || {
      label: slug.toString().replace(/-/g, " ").toLowerCase(),
      icon: BookIcon,
    }
  );
};

export const getSeriesBySlug = (slug: string) => {
  const series = {
    x: {
      label: "Series X",
      icon: LucideBook,
      description: "A Sample Series",
    },
    // Add more series here as needed
  };

  return (
    series[slug as keyof typeof series] || {
      label: slug.charAt(0).toUpperCase() + slug.slice(1),
      icon: LucideBook,
      description: `Articles in the ${
        slug.charAt(0).toUpperCase() + slug.slice(1)
      } series.`,
    }
  );
};
