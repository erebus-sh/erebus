import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BlogConfiguration } from "./types";
import type { BlogPost } from "@/lib/source";
import { cn } from "./utils";

interface PostCardProps {
  post: NonNullable<BlogPost>;
  configuration?: BlogConfiguration;
}

export function PostCard({
  post,
  configuration = {
    config: {
      blogBase: "/blog",
      blogOgImageBase: "blog-og",
      pageSize: 5,
    },
  },
}: PostCardProps) {
  const CardComponent = configuration.Card || null;
  const cardClassName =
    "order-last border-0 bg-transparent shadow-none sm:order-first sm:col-span-12 lg:col-span-10 lg:col-start-2";

  const cardContent = (
    <div className="grid gap-y-6 sm:grid-cols-10 sm:gap-x-5 sm:gap-y-0 md:items-center md:gap-x-8 lg:gap-x-12">
      <div className="sm:col-span-5">
        <div className="mb-4 md:mb-6">
          <div className="flex flex-wrap gap-3 text-xs uppercase tracking-wider text-muted-foreground md:gap-5 lg:gap-6">
            {post.data.tags?.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
        <h3 className="text-xl font-semibold md:text-2xl lg:text-3xl text-left">
          <Link href={post.url} className="hover:underline cursor-pointer">
            {post.data.title}
          </Link>
        </h3>
        <p className="mt-4 text-muted-foreground md:mt-5 text-left">
          {post.data.description}
        </p>
        <div className="mt-6 flex items-center space-x-4 text-sm md:mt-8">
          <span className="text-muted-foreground capitalize">
            {post.data.author || "Anonymous"}
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            {new Date(post.data.date).toDateString()}
          </span>
        </div>
        <div className="mt-6 flex items-center space-x-2 md:mt-8">
          <Link
            href={post.url}
            className="inline-flex items-center font-semibold hover:underline md:text-base"
          >
            <span>Read more</span>
            <ArrowRight className="ml-2 size-4 transition-transform" />
          </Link>
        </div>
      </div>
      <div className="order-first sm:order-last sm:col-span-5">
        <Link href={post.url} className="block">
          <div className="aspect-[16/9] overflow-clip rounded-lg border border-border">
            <img
              src={`https://picsum.photos/400/225?grayscale&title=${post.data.title}`}
              alt={post.data.title}
              className="h-full w-full object-cover transition-opacity duration-200 fade-in hover:opacity-70"
            />
          </div>
        </Link>
      </div>
    </div>
  );

  return CardComponent ? (
    <CardComponent key={post.url} className={cardClassName}>
      {cardContent}
    </CardComponent>
  ) : (
    <div key={post.url} className={cardClassName}>
      {cardContent}
    </div>
  );
}
