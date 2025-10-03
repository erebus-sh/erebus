"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Roadmap } from "@repo/schemas";
import { ExternalLink, Calendar, User, Search, Filter } from "lucide-react";
import { useMemo, useState } from "react";

interface RoadmapContentProps {
  roadmap: Roadmap[];
}

export function RoadmapContent({ roadmap }: RoadmapContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  // Get all unique labels
  const allLabels = useMemo(() => {
    const labels = new Set<string>();
    roadmap.forEach((item) => {
      item.labels.forEach((label) => labels.add(label));
    });
    return Array.from(labels).sort();
  }, [roadmap]);

  // Get all unique statuses
  const allStatuses = useMemo(() => {
    const statuses = new Set<string>();
    roadmap.forEach((item) => statuses.add(item.status));
    return Array.from(statuses).sort();
  }, [roadmap]);

  // Filter roadmap items
  const filteredRoadmap = useMemo(() => {
    return roadmap.filter((item) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesDescription = item.description
          ?.toLowerCase()
          .includes(query);
        const matchesAuthor = item.author.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription && !matchesAuthor) {
          return false;
        }
      }

      // Status filter
      if (selectedStatus && item.status !== selectedStatus) {
        return false;
      }

      // Label filter
      if (selectedLabel && !item.labels.includes(selectedLabel)) {
        return false;
      }

      return true;
    });
  }, [roadmap, searchQuery, selectedStatus, selectedLabel]);

  const activeFiltersCount =
    (searchQuery ? 1 : 0) + (selectedStatus ? 1 : 0) + (selectedLabel ? 1 : 0);

  return (
    <>
      {/* Filters */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>
            Filters {activeFiltersCount > 0 && `(${activeFiltersCount} active)`}
          </span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by title, description, or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          <button
            onClick={() => setSelectedStatus(null)}
            className={`rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors ${
              selectedStatus === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            All
          </button>
          {allStatuses.map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`rounded-md px-2.5 py-0.5 text-xs font-semibold capitalize transition-colors ${
                selectedStatus === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {allLabels.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Labels:</span>
            <button
              onClick={() => setSelectedLabel(null)}
              className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                selectedLabel === null
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              All
            </button>
            {allLabels.map((label) => (
              <button
                key={label}
                onClick={() => setSelectedLabel(label)}
                className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                  selectedLabel === label
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredRoadmap.length} of {roadmap.length} items
        </div>
      </div>

      {/* Roadmap Items */}
      <div className="space-y-6">
        {filteredRoadmap.map((item) => {
          const isOpen = item.status === "open";
          const createdDate = new Date(item.createdAt).toLocaleDateString(
            "en-US",
            {
              year: "numeric",
              month: "short",
              day: "numeric",
            },
          );

          return (
            <Card
              key={item.id}
              className="group transition-all hover:shadow-md"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-xl">{item.title}</CardTitle>
                      <Badge
                        variant={isOpen ? "default" : "secondary"}
                        className="text-xs capitalize"
                      >
                        {item.status}
                      </Badge>
                    </div>
                    {item.description && (
                      <CardDescription className="line-clamp-3">
                        {item.description}
                      </CardDescription>
                    )}
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </a>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Labels */}
                {item.labels.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {item.labels.map((label, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="cursor-pointer text-xs hover:bg-accent"
                        onClick={() => setSelectedLabel(label)}
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Meta Information */}
                <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    <span>{item.author}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>{createdDate}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredRoadmap.length === 0 && (
          <Card className="py-12">
            <CardContent className="text-muted-foreground text-center">
              <p className="text-lg">No items match your filters.</p>
              <p className="mt-2 text-sm">
                Try adjusting your search criteria.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
