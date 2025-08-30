import React from "react";
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from "fumadocs-ui/page";
import { BlogConfiguration } from "./types";

import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { Calendar, BookOpen } from "lucide-react";
import Link from "next/link";
import { cn } from "./utils";

// Popover and Badge configuration come from configuration context
import { SeriesPopoverContent } from "./series-info";
import { getSeriesInfo } from "./utils";
import { slot } from "./shared";
import { createUrlUtils } from "./url-utils";

interface SinglePostProps {
  page: any;
  category?: string;
  lastUpdate?: Date;
  tags: string[];
  configuration?: BlogConfiguration;
  getCategoryBySlug: (slug: string) => any;
  mdxComponents: any;
  posts?: any[];
}

export function SinglePost({
  page,
  configuration = { config: { blogBase: "/blog", pageSize: 5 } },
  category,
  lastUpdate,
  tags,
  getCategoryBySlug,
  mdxComponents,
  posts = [],
}: SinglePostProps) {
  // Use configuration.cn if available, otherwise use the imported cn
  const classNames = configuration?.cn || cn;
  const MDX = page.data.body;

  return (
    <>
      <div className="relative container px-4 py-8 lg:py-12 lg:px-6 text-left">
        {slot(configuration?.backgroundPattern, null)}

        {category && (
          <div className="mb-4 text-gray-600 dark:text-gray-400 text-sm font-medium">
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 capitalize">
                {getCategoryBySlug(category).icon &&
                  React.createElement(getCategoryBySlug(category).icon, {
                    className: "h-4 w-4",
                  })}
                <Link
                  href={
                    configuration?.config
                      ? createUrlUtils(configuration.config).getCategoryUrl(
                          category,
                        )
                      : `/blog/${category}`
                  }
                >
                  {getCategoryBySlug(category).label}
                </Link>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {lastUpdate?.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        )}
        <DocsTitle className="text-left dark:text-white flex items-center gap-2">
          {page.data.title}

          {page.data.series &&
            page.data.seriesPart &&
            configuration.Popover &&
            configuration.PopoverTrigger &&
            configuration.PopoverContent &&
            configuration.Badge &&
            configuration.Button && (
              <configuration.Popover>
                <configuration.PopoverTrigger asChild>
                  <configuration.Button
                    size="icon"
                    variant="ghost"
                    className="relative ml-1 bg-foreground/5"
                    aria-label="View series information"
                  >
                    <BookOpen className="size-5" aria-hidden="true" />
                    <configuration.Badge className="absolute -top-2 left-full min-w-5 -translate-x-1/2 px-1 text-xs">
                      {page.data.seriesPart}/
                      {getSeriesInfo(page.data.series, posts)?.totalParts || 0}
                    </configuration.Badge>
                  </configuration.Button>
                </configuration.PopoverTrigger>
                <configuration.PopoverContent className="w-80 p-0">
                  <SeriesPopoverContent
                    seriesName={page.data.series}
                    currentPart={page.data.seriesPart}
                    posts={posts}
                    configuration={configuration}
                  />
                </configuration.PopoverContent>
              </configuration.Popover>
            )}
        </DocsTitle>
        <DocsDescription className="text-left mt-3 dark:text-gray-300">
          {page.data.description}
        </DocsDescription>
        <div className="flex flex-wrap gap-2 mt-4">
          {tags.length > 0 &&
            tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300 rounded-full text-xs font-medium"
              >
                {tag}
              </span>
            ))}
        </div>
      </div>

      <DocsLayout
        nav={{ enabled: false }}
        tree={{
          name: "Tree",
          children: [],
        }}
        sidebar={{ enabled: false, prefetch: false, tabs: false }}
        containerProps={{
          className: classNames(
            "flex-row-reverse",
            "relative container [--fd-nav-height:calc(var(--spacing)*14)] md:[--fd-nav-height:57px]",
          ),
        }}
      >
        {slot(configuration?.backgroundPattern, null)}

        <div className="grid grid-cols-4">
          <DocsPage
            toc={page.data.toc}
            full={page.data.full}
            lastUpdate={lastUpdate}
            footer={{
              enabled: false,
            }}
            tableOfContent={{
              style: "clerk",
              single: false,
            }}
            article={{
              className: classNames(
                "!m-[unset] max-w-none bg-zinc-50/50 dark:bg-zinc-900/50 py-8 md:py-12",
              ),
            }}
          >
            <DocsBody>
              <MDX configuration={mdxComponents} />
            </DocsBody>
          </DocsPage>
        </div>
      </DocsLayout>
    </>
  );
}
