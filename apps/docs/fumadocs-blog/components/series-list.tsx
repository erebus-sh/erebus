import React from "react";
import Link from "next/link";
import { getPostsBySeries } from "./utils";
import { BookOpen } from "lucide-react";
import { BlogConfiguration } from "./types";
import { slot } from "./shared";

interface SeriesListProps {
  seriesSlug: string;
  configuration?: BlogConfiguration;
  posts?: any[];
  getSortedByDatePosts?: any;
  getSeriesBySlug: (slug: string) => any;
}

export function SeriesList({
  seriesSlug,
  configuration = {},
  posts = [],
  getSeriesBySlug,
}: SeriesListProps) {
  const seriesInfo = getSeriesBySlug(seriesSlug);
  const seriesPosts = posts
    .filter((post) => post.data.series === seriesSlug)
    .sort((a, b) => {
      return a.data.seriesPart - b.data.seriesPart;
    });

  return (
    <div className="container px-4 py-8 lg:py-12 lg:px-6">
      {slot(configuration?.backgroundPattern, null)}
      <div className="relative">
        <div className="flex flex-col md:flex-row gap-8 mb-8 md:items-center items-start">
          {configuration.Book && (
            <configuration.Book
              color="#3b82f6"
              depth={6}
              width={150}
              illustration={
                <div className="flex items-center justify-center h-full w-full p-4">
                  <BookOpen size={32} className="text-white" />
                </div>
              }
            >
              <div className="p-3 mb-2 grid gap-2">
                <h3 className="font-semibold text-sm">{seriesInfo.label}</h3>
                <div className="text-xs">{posts.length} Parts</div>
              </div>
            </configuration.Book>
          )}
          <div className="flex flex-col justify-center">
            <h1 className="text-4xl font-bold mb-3 text-gray-900 dark:text-white leading-tight">
              {seriesInfo.label}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              {seriesInfo.description}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {seriesPosts.map((post) => (
            <div
              key={post.url}
              className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-medium">
                  {post.data.seriesPart || ""}
                </div>
                <div className="flex-1">
                  <Link href={post.url}>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 mb-2">
                      {post.data.title}
                    </h2>
                  </Link>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    {post.data.description}
                  </p>
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <span>
                      {post.data.date.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                    {post.data.tags && post.data.tags.length > 0 && (
                      <>
                        <span className="mx-2">•</span>
                        <div className="flex flex-wrap gap-2">
                          {post.data.tags.map((tag: string) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
