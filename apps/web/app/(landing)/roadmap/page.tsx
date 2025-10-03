import type { RoadmapListResponse } from "@repo/schemas";
import { RoadmapContent } from "./roadmap-content";

export default async function RoadmapPage() {
  const response = await fetch("https://roadmap.erebus.sh/api/roadmap");
  const data: RoadmapListResponse = await response.json();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Roadmap
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg">
            Track the progress of Erebus. View planned features, ongoing work,
            and completed milestones.
          </p>
        </div>

        {/* Roadmap Content with Filters */}
        <RoadmapContent roadmap={data.roadmap} />
      </div>
    </div>
  );
}
