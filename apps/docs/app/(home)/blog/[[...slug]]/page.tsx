import { blogSource, getBlogPosts } from "@/lib/source";
import {
  BlogWrapper,
  generateBlogMetadata,
  generateBlogStaticParams,
} from "@/fumadocs-blog";
import {
  createBlogMetadata,
  blogConstants,
  getBlogConfiguration,
} from "@/blog-configuration";
import { getCategoryBySlug } from "@/blog-configuration";
import { getSeriesBySlug } from "@/blog-configuration";
import { getMDXComponents } from "@/mdx-components";
import type { Metadata } from "next";

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const posts = getBlogPosts();

  return (
    <BlogWrapper
      params={params}
      blogSource={blogSource}
      posts={posts}
      getCategoryBySlug={getCategoryBySlug}
      getSeriesBySlug={getSeriesBySlug}
      mdxComponents={getMDXComponents()}
      configuration={getBlogConfiguration()}
      includeDrafts={process.env.NODE_ENV !== "production"}
    />
  );
}

export async function generateStaticParams() {
  const posts = getBlogPosts();
  return generateBlogStaticParams(blogSource, posts);
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;

  return generateBlogMetadata({
    params,
    createBlogMetadata,
    blogConstants,
    blogSource,
    getCategoryBySlug,
    getSeriesBySlug,
  });
}
