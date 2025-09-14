import { type BlogPost } from "@/lib/source";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns posts sorted by date (newest first)
 */
export const getSortedByDatePosts = (
  posts: BlogPost[],
  includeDrafts: boolean = false,
): BlogPost[] => {
  const filteredPosts = posts.filter(
    (post) => includeDrafts || !post.data.draft,
  );

  return [...filteredPosts].sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
};

/**
 * Returns all unique series names from posts
 */
export const getSeriesNames = (posts: BlogPost[]) => {
  const seriesSet = new Set<string>();

  for (const post of posts) {
    if (post.data.series) {
      seriesSet.add(post.data.series);
    }
  }

  return Array.from(seriesSet).sort();
};

/**
 * Returns all posts for a specific series
 */
export const getPostsBySeries = (seriesName: string, posts: BlogPost[]) => {
  return posts
    .filter((post) => post.data.series === seriesName)
    .sort((a, b) => {
      // Sort by seriesPart if available, otherwise by date
      if (a.data.seriesPart && b.data.seriesPart) {
        return a.data.seriesPart - b.data.seriesPart;
      }
      return a.data.date.getTime() - b.data.date.getTime();
    });
};

/**
 * Returns comprehensive information about a series
 */
export const getSeriesInfo = (seriesName: string, posts: BlogPost[]) => {
  const seriesPosts = getPostsBySeries(seriesName, posts);
  if (seriesPosts.length === 0) return null;

  // Use the first post's title to extract series name if possible
  const firstPost = seriesPosts[0];
  if (!firstPost) return null;

  const title = firstPost.data.title || "";
  const seriesTitle = title.includes("Part")
    ? title.split("Part")[0].trim()
    : seriesName.charAt(0).toUpperCase() + seriesName.slice(1);

  return {
    name: seriesName,
    title: seriesTitle,
    posts: seriesPosts,
    totalParts: seriesPosts.length,
  };
};

/**
 * Returns all posts for a specific category
 */
export const getPostsByCategory = (category: string, posts: BlogPost[]) => {
  return posts.filter((post) => post.slugs && post.slugs[0] === category);
};

/**
 * Returns a specific post by category and slug
 */
export const getPostsByCategoryAndSlug = (
  category: string,
  slug: string,
  posts: BlogPost[],
) => {
  return (
    posts.filter(
      (post) =>
        post.slugs && post.slugs[0] === category && post.slugs[1] === slug,
    )[0] || undefined
  );
};

/**
 * Returns all unique tags from posts
 */
export const getTags = (posts: BlogPost[]) => {
  const tagSet = new Set<string>();

  for (const post of posts) {
    if (post.data.tags) {
      for (const tag of post.data.tags) {
        tagSet.add(tag);
      }
    }
  }

  return Array.from(tagSet).sort();
};

/**
 * Returns all posts for a specific tag
 */
export const getPostsByTag = (tag: string, posts: BlogPost[]) => {
  return posts.filter((post) => post.data.tags?.includes(tag));
};
