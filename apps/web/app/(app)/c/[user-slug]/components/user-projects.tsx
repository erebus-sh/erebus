"use client";

import { api } from "@/convex/_generated/api";
import { useQueryWithState } from "@/utils/query";
import Spinner from "@/components/spinner";
import ProjectCard from "./project-card";
import CreateProjectDialog from "./create-project-dialog";
import { Earth, FolderIcon } from "lucide-react";

export default function UserProjects() {
  const { data, isPending, isError } = useQueryWithState(
    api.projects.query.getProjects,
  );

  if (isError)
    return (
      <div>
        Opss... something went wrong, please contact hey@v0id.me or just refresh
        the page.
      </div>
    );

  if (!data || data.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        {isPending && <Spinner />}
        {!isPending && (
          <>
            <div className="bg-muted mx-auto flex h-20 w-20 items-center justify-center rounded-full">
              <Earth className="text-muted-foreground h-10 w-10" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">No projects yet</h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm">
              Get started by creating your first project. Deploy your real-time
              infrastructure at the edge in seconds.
            </p>
            <div className="mt-6">
              <CreateProjectDialog />
            </div>
            <div className="text-muted-foreground mt-8 text-xs">
              <p>
                Need help? Check out our{" "}
                <a
                  href={`${process.env.NEXT_PUBLIC_DOCS_URL}`}
                  className="hover:text-foreground underline"
                >
                  documentation
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto mt-6 w-full max-w-7xl">
      {isPending && <Spinner />}
      {!isPending && (
        <>
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderIcon className="text-muted-foreground h-5 w-5" />
              <h2 className="text-lg font-semibold">Projects</h2>
              <span className="text-muted-foreground text-sm">
                ({data.length})
              </span>
            </div>
            <CreateProjectDialog />
          </div>
          <ProjectCard projects={data} />
        </>
      )}
    </div>
  );
}
