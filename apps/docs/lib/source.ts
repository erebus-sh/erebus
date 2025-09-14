import { docs, blog } from "@/.source";
import { loader } from "fumadocs-core/source";
import { createMDXSource } from "fumadocs-mdx";

export const blogSource = loader({
  baseUrl: "/blog",
  source: createMDXSource(blog),
});

export const {
  getPage: getBlogPost,
  getPages: getBlogPosts,
  pageTree: pageBlogTree,
} = blogSource;

export type BlogPost = NonNullable<ReturnType<typeof getBlogPost>>;

export const source = loader({
  // it assigns a URL to your pages
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
