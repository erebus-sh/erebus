import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  // Configure pageExtensions to include md and mdx
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],

  compiler: {
    removeConsole: true,
  },

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,

  // Add rewrites to support PostHog
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
};

const withMDX = createMDX({
  // Add markdown plugins here, as desired
  options: {
    remarkPlugins: [
      // Handle frontmatter first
      "remark-frontmatter",
      // Extract frontmatter as exports
      "remark-mdx-frontmatter",
      // GitHub Flavored Markdown
      "remark-gfm",
      // Table of contents - insert after GFM processing
      [
        "remark-toc",
        {
          heading: "Table of Contents",
          tight: true,
          maxDepth: 3,
          skip: "h1",
          ordered: false,
        },
      ],
    ],
    rehypePlugins: [
      // Add IDs to headings for TOC linking
      "rehype-slug",
      // Add links to headings
      [
        "rehype-autolink-headings",
        {
          behavior: "wrap",
          properties: {
            className: ["anchor"],
          },
        },
      ],
    ],
  },
  // Ensure MDX files are processed correctly
  extension: /\.mdx?$/,
});

// Merge MDX config with Next.js config
export default withMDX(nextConfig);
