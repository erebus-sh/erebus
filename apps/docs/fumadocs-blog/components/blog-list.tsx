import { PostList } from "./post-list";
import { BlogConfiguration } from "./types";
import { type BlogPost } from "@/lib/source";
import { getSortedByDatePosts } from "./utils";
import { createUrlUtils } from "./url-utils";

export function RecentPosts({
  posts,
  heading = "Recent Posts",
  description,
  recentPostsLimit = 3,
  configuration,
}: {
  posts: BlogPost[];
  heading?: string;
  description?: string;
  recentPostsLimit?: number;
  configuration?: BlogConfiguration;
}) {
  const sortedPosts = getSortedByDatePosts(posts);
  const displayPosts = sortedPosts.slice(0, recentPostsLimit);
  const totalPages = 1;

  return (
    <PostList
      posts={displayPosts}
      currentPage={1}
      totalPages={totalPages}
      disablePagination={true}
      heading={heading}
      description={description}
      configuration={configuration}
    />
  );
}

export function BlogList({
  page = 1,
  disablePagination = false,
  configuration,
  posts,
  heading,
  description,
}: {
  page?: number;
  disablePagination?: boolean;
  configuration?: BlogConfiguration;
  posts: BlogPost[];
  heading?: string;
  description?: string;
}) {
  const pageSize = configuration?.config?.pageSize || 5;
  const displayPosts = posts.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(posts.length / pageSize);

  const urlUtils = configuration?.config
    ? createUrlUtils(configuration.config)
    : null;
  const basePath = urlUtils?.getBlogUrl() || "/blog";

  return (
    <PostList
      posts={displayPosts}
      currentPage={page}
      totalPages={totalPages}
      disablePagination={disablePagination}
      configuration={configuration}
      heading={heading}
      description={description}
      basePath={basePath}
    />
  );
}

export function CategoryBlogList({
  category,
  page = 1,
  disablePagination = false,
  configuration,
  posts,
  getCategoryBySlug,
}: {
  category: string;
  page?: number;
  disablePagination?: boolean;
  configuration?: BlogConfiguration;
  posts: BlogPost[];
  getCategoryBySlug: (slug: string) => any;
}) {
  const pageSize = configuration?.config?.pageSize || 5;
  const categoryInfo = getCategoryBySlug(category);
  const filteredPosts = posts.filter(
    (post) => post.slugs && post.slugs[0] === category,
  );
  const displayPosts = filteredPosts.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const totalPages = Math.ceil(filteredPosts.length / pageSize);

  const urlUtils = configuration?.config
    ? createUrlUtils(configuration.config)
    : null;
  const basePath = urlUtils?.getCategoryUrl(category) || `/blog/${category}`;

  return (
    <PostList
      posts={displayPosts}
      currentPage={page}
      totalPages={totalPages}
      heading={categoryInfo.label}
      description={categoryInfo.description}
      basePath={basePath}
      disablePagination={disablePagination}
      configuration={configuration}
    />
  );
}
