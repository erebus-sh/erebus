import { Pagination } from "./pagination";
import { DocsTitle, DocsDescription } from "fumadocs-ui/page";
import { BlogConfiguration } from "./types";
import { type BlogPost } from "@/lib/source";
import { slot } from "./shared";

export type PostListProps = {
  posts: BlogPost[];
  currentPage: number;
  totalPages: number;
  heading?: string;
  description?: string;
  basePath?: string;
  disablePagination?: boolean;
  configuration?: BlogConfiguration;
};

export function PostList({
  posts,
  currentPage,
  totalPages,
  heading = "Blog Posts",
  description = "The Erebus blog shares insights, tutorials, and updates on building real time infrastructure and improving developer experience.",
  basePath = "/blog",
  disablePagination = false,
  configuration,
}: PostListProps) {
  // PostCard is now imported directly

  return (
    <>
      <section className="relative container px-4 py-8 lg:py-12 lg:px-6 text-left bg-zinc-50/50 dark:bg-zinc-900/50">
        {slot(configuration?.backgroundPattern, null)}

        <div className="text-center">
          <DocsTitle className="dark:text-white capitalize">
            {heading}
          </DocsTitle>
          <DocsDescription className="mt-3 dark:text-gray-300 mb-0">
            {description}
          </DocsDescription>
        </div>
      </section>

      <section className="relative container px-4 py-8 lg:py-12 lg:px-6 text-left">
        {slot(configuration?.backgroundPattern, null)}
        <div className="grid gap-y-10 sm:grid-cols-12 sm:gap-y-12 md:gap-y-16 lg:gap-y-20">
          {posts
            .filter(
              (post): post is NonNullable<typeof post> => post !== undefined,
            )
            .map((post) => {
              if (configuration?.PostCard) {
                return (
                  <configuration.PostCard
                    key={post.url}
                    post={post}
                    configuration={configuration}
                  />
                );
              }
            })}
        </div>

        {!disablePagination && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            basePath={basePath}
            configuration={configuration}
          />
        )}
      </section>
    </>
  );
}
