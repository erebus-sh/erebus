import React from "react";
import Link from "next/link";
import { getSeriesInfo } from "./utils";
import { cn } from "./utils";
import { BlogConfiguration } from "./types";
import { createUrlUtils } from "./url-utils";

interface SeriesComponentProps {
  seriesName: string;
  currentPart: number;
  posts: any[];
  configuration?: BlogConfiguration;
}

export function SeriesPopoverContent({
  seriesName,
  currentPart,
  posts,
  configuration,
}: SeriesComponentProps) {
  const classNames = configuration?.cn || cn;
  const seriesInfo = getSeriesInfo(seriesName, posts);
  if (!seriesInfo) return null;

  const { title, posts: seriesPosts, totalParts } = seriesInfo;

  return (
    <div className="p-4">
      <div className="mb-2 font-medium text-gray-900 dark:text-white">
        Part {currentPart} of {totalParts} in series:{" "}
        <Link
          href={
            configuration?.config
              ? createUrlUtils(configuration.config).getSeriesUrl(seriesName)
              : `/blog/series/${seriesName}`
          }
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {title}
        </Link>
      </div>
      <div className="space-y-1">
        {seriesPosts.map((post, index) => (
          <div
            key={post.url}
            className={classNames(
              "flex items-center",
              post.data.seriesPart === currentPart
                ? "font-medium text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400",
            )}
          >
            <span className="mr-2 text-sm">
              {(post.data.seriesPart || index + 1).toString().padStart(2, "0")}
            </span>
            <Link
              href={post.url}
              className={classNames(
                "hover:underline",
                post.data.seriesPart === currentPart
                  ? ""
                  : "hover:text-blue-600 dark:hover:text-blue-400",
              )}
            >
              {post.data.title}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SeriesInfo({
  seriesName,
  currentPart,
  posts,
  configuration,
}: SeriesComponentProps) {
  // Use configuration.cn if available, otherwise use the imported cn
  const classNames = configuration?.cn || cn;
  const seriesInfo = getSeriesInfo(seriesName, posts);
  if (!seriesInfo) return null;

  const { title, posts: seriesPosts, totalParts } = seriesInfo;

  return (
    <div className="my-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="mb-2 font-medium text-gray-900 dark:text-white">
        Part {currentPart} of {totalParts} in series:{" "}
        <Link
          href={
            configuration?.config
              ? createUrlUtils(configuration.config).getSeriesUrl(seriesName)
              : `/blog/series/${seriesName}`
          }
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {title}
        </Link>
      </div>
      <div className="space-y-1">
        {seriesPosts.map((post, index) => (
          <div
            key={post.url}
            className={classNames(
              "flex items-center",
              post.data.seriesPart === currentPart
                ? "font-medium text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400",
            )}
          >
            <span className="mr-2 text-sm">
              {(post.data.seriesPart || index + 1).toString().padStart(2, "0")}
            </span>
            <Link
              href={post.url}
              className={classNames(
                "hover:underline",
                post.data.seriesPart === currentPart
                  ? ""
                  : "hover:text-blue-600 dark:hover:text-blue-400",
              )}
            >
              {post.data.title}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
