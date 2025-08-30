import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  isBlogRootPage,
  isSeriesPage,
  isCategoryPage,
  isPaginatedBlogPage,
  isPaginatedCategoryPage,
  isSinglePostPage,
  getSeriesSlug,
  getCategorySlug,
} from "./page-type";
import { createUrlUtils } from "./url-utils";

// Helper function to generate image metadata for OpenGraph and Twitter
function getImageMetadata(url: string, blogConstants: any) {
  return {
    alt: blogConstants.blogTitle,
    url,
    width: 1200,
    height: 630,
  };
}

export async function generateBlogMetadata(props: {
  params: { slug?: string[] };
  createBlogMetadata: (override: Metadata, blogConstants: any) => Metadata;
  blogConstants: any;
  blogSource: any;
  getCategoryBySlug: (slug: string) => any;
  getSeriesBySlug: (slug: string) => any;
}): Promise<Metadata> {
  const {
    params,
    createBlogMetadata,
    blogConstants,
    blogSource,
    getCategoryBySlug,
    getSeriesBySlug,
  } = props;

  // Create URL utilities instance
  const urlUtils = createUrlUtils({
    blogBase: blogConstants.blogBase,
    blogOgImageBase: blogConstants.blogOgImageBase,
  });

  // Default for root blog page or when slug is undefined
  if (isBlogRootPage(params)) {
    const imageMetaData = getImageMetadata(
      urlUtils.getBlogOgImageUrl(),
      blogConstants,
    );

    return createBlogMetadata(
      {
        title: blogConstants.blogTitle,
        description: blogConstants.blogDescription,
        openGraph: {
          url: urlUtils.getBlogUrl(),
          images: imageMetaData,
        },
        twitter: {
          images: imageMetaData,
        },
        alternates: {
          canonical: urlUtils.getBlogUrl(),
        },
      },
      blogConstants,
    );
  }

  // Handle blog post page
  if (isSinglePostPage(params)) {
    const page = blogSource.getPage(params.slug);
    if (!page) notFound();

    const imageMetaData = getImageMetadata(
      urlUtils.getBlogPostOgImageUrl(params.slug || []),
      blogConstants,
    );

    return createBlogMetadata(
      {
        title: page.data.title,
        description: page.data.description,
        openGraph: {
          url: page.url,
          images: imageMetaData,
        },
        twitter: {
          images: imageMetaData,
        },
        alternates: {
          canonical: page.url,
        },
      },
      blogConstants,
    );
  }

  // Handle series page
  if (isSeriesPage(params)) {
    const seriesSlug = getSeriesSlug(params)!;
    const series = getSeriesBySlug(seriesSlug);

    const canonicalUrl = urlUtils.getSeriesUrl(seriesSlug);

    const imageMetaData = getImageMetadata(
      urlUtils.getSeriesOgImageUrl(seriesSlug),
      blogConstants,
    );

    const metadata = createBlogMetadata(
      {
        title: `${series.label}`,
        description: series.description,
        openGraph: {
          url: canonicalUrl,
          images: imageMetaData,
        },
        twitter: {
          images: imageMetaData,
        },
        alternates: {
          canonical: canonicalUrl,
        },
      },
      blogConstants,
    );

    return metadata;
  }

  // Handle category page
  if (isCategoryPage(params)) {
    const category = getCategorySlug(params);
    if (!category) {
      return createBlogMetadata(
        {
          title: blogConstants.blogTitle,
          description: blogConstants.blogDescription,
          openGraph: {
            url: blogConstants.urls.blogBase,
          },
          alternates: {
            canonical: blogConstants.urls.blogBase,
          },
        },
        blogConstants,
      );
    }

    const canonicalUrl = urlUtils.getCategoryUrl(category);
    const categoryInfo = getCategoryBySlug(category);

    const imageMetaData = getImageMetadata(
      urlUtils.getCategoryOgImageUrl(category),
      blogConstants,
    );

    const metadata = createBlogMetadata(
      {
        title: `${categoryInfo.label}`,
        description: categoryInfo.description,
        openGraph: {
          url: canonicalUrl,
          images: imageMetaData,
        },
        twitter: {
          images: imageMetaData,
        },
        alternates: {
          canonical: canonicalUrl,
        },
      },
      blogConstants,
    );

    return metadata;
  }

  // Handle paginated root blog page
  if (isPaginatedBlogPage(params) && params.slug) {
    const page = Number(params.slug[1]);
    const canonicalUrl = urlUtils.getBlogUrl(); // Use main blog URL as canonical for all paginated pages

    const imageMetaData = getImageMetadata(
      urlUtils.getBlogOgImageUrl(),
      blogConstants,
    );

    return createBlogMetadata(
      {
        title: blogConstants.paginationTitle(page),
        description: blogConstants.paginationDescription(page),
        openGraph: {
          url: canonicalUrl,
          images: imageMetaData,
        },
        twitter: {
          images: imageMetaData,
        },
        alternates: {
          canonical: canonicalUrl,
        },
      },
      blogConstants,
    );
  }

  // Handle paginated category page
  if (isPaginatedCategoryPage(params) && params.slug) {
    const category = params.slug[0] || "";
    const page = Number(params.slug[2] || "1");
    const canonicalUrl = urlUtils.getCategoryUrl(category); // Use main category URL as canonical

    const imageMetaData = getImageMetadata(
      urlUtils.getCategoryOgImageUrl(category),
      blogConstants,
    );

    return createBlogMetadata(
      {
        title: blogConstants.categoryPaginationTitle(category, page),
        description: blogConstants.categoryPaginationDescription(
          category,
          page,
        ),
        openGraph: {
          url: canonicalUrl,
          images: imageMetaData,
        },
        twitter: {
          images: imageMetaData,
        },
        alternates: {
          canonical: canonicalUrl,
        },
      },
      blogConstants,
    );
  }

  const imageMetaData = getImageMetadata(
    urlUtils.getBlogOgImageUrl(),
    blogConstants,
  );

  // Default fallback
  return createBlogMetadata(
    {
      title: blogConstants.blogTitle,
      description: blogConstants.blogDescription,
      openGraph: {
        url: urlUtils.getBlogUrl(),
        images: imageMetaData,
      },
      twitter: {
        images: imageMetaData,
      },
      alternates: {
        canonical: urlUtils.getBlogUrl(),
      },
    },
    blogConstants,
  );
}
