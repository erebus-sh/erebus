"use client";

import { api } from "@/convex/_generated/api";
import { useQueryWithState } from "@/utils/query";
import { useParams } from "next/navigation";

export default function GuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const slug = params["user-slug"] as string;
  const projectSlug = params["proj-slug"] as string;
  const { data, isPending } = useQueryWithState(
    api.user_profile.query.getUserProfileBySlug,
    {
      slug,
    },
  );

  const { data: projectData, isPending: projectIsPending } = useQueryWithState(
    api.projects.query.getProjectBySlug,
    {
      slug: projectSlug,
    },
  );

  if (slug && !isPending && !data) {
    return <div>User not found</div>;
  }

  if (projectSlug && !projectIsPending && !projectData) {
    return <div>Project not found</div>;
  }

  return <>{children}</>;
}
