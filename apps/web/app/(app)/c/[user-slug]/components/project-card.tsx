"use client";

import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardHeader,
  CardTitle,
  CardFooter,
  CardContent,
} from "@/components/ui/card";
import { MoreVertical, Globe, Clock, Activity } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ConvexError } from "convex/values";

// --- Reusable IconLabel component ---
function IconLabel({
  icon: Icon,
  label,
  className,
  ...props
}: {
  icon: React.ElementType;
  label: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "text-muted-foreground flex items-center gap-1 text-xs",
        className,
      )}
      {...props}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export default function ProjectCard({
  projects,
}: {
  projects: Doc<"projects">[];
}) {
  const params = useParams();
  const userSlug = params["user-slug"] as string;

  const deleteProject = useMutation(api.projects.mutation.deleteProject);

  if (!userSlug) return null;

  const handleDelete = async (projectId: string) => {
    try {
      await deleteProject({ projectId: projectId as Id<"projects"> });
      toast.success("Project deleted successfully");
    } catch (error: unknown) {
      if (error instanceof ConvexError) {
        toast.error(
          "This project cannot be deleted because it has usage data.",
        );
        return;
      }
      toast.error("Failed to delete project");
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Card
          key={project._id}
          tabIndex={0}
          aria-label={`Project card for ${project.title}`}
          className={clsx(
            "group bg-background border-border relative border transition-all duration-200",
            "focus-within:-translate-y-1 focus-within:shadow-lg hover:-translate-y-1 hover:shadow-lg",
            "focus-within:ring-primary/60 ring-0 outline-none focus-within:ring-2",
          )}
        >
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1.5">
                <CardTitle className="truncate text-base leading-tight font-semibold">
                  <Link
                    href={`/c/${userSlug}/projects/${project.slug}`}
                    aria-label={`Open project ${project.title}`}
                    tabIndex={0}
                    className={clsx(
                      "focus-visible:ring-primary/60 focus:outline-none focus-visible:ring-2",
                      "transition-colors duration-150 hover:underline",
                    )}
                  >
                    {project.title}
                  </Link>
                </CardTitle>
                <p className="text-muted-foreground truncate text-xs">
                  {project.slug}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Open project actions menu"
                    className={clsx(
                      "h-8 w-8 rounded-full p-0 transition-opacity duration-150",
                      "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
                      "focus-visible:ring-primary/60 focus-visible:ring-2",
                    )}
                  >
                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[180px] rounded-md shadow-lg focus:outline-none"
                  sideOffset={8}
                >
                  <DropdownMenuLabel className="text-muted-foreground text-xs font-semibold">
                    Actions
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      href={`/c/${userSlug}/projects/${project.slug}`}
                      tabIndex={0}
                      aria-label={`View project ${project.title}`}
                      className="focus-visible:ring-primary/60 focus:outline-none focus-visible:ring-2"
                    >
                      View Project
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href={`/c/${userSlug}/projects/${project.slug}/settings`}
                      tabIndex={0}
                      aria-label={`Project settings for ${project.title}`}
                      className="focus-visible:ring-primary/60 focus:outline-none focus-visible:ring-2"
                    >
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDelete(project._id)}
                    className={clsx(
                      "text-red-600 focus:text-red-700",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400",
                    )}
                    aria-label={`Delete project ${project.title}`}
                  >
                    Delete Project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>

          <CardContent className="pt-0 pb-2">
            <div className="flex items-center justify-between">
              <Badge
                variant={project.status === "active" ? "default" : "secondary"}
                className={clsx(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
                  project.status === "active"
                    ? "bg-green-100 text-green-800"
                    : "bg-muted text-muted-foreground",
                )}
                aria-label={`Project status: ${project.status}`}
              >
                <Activity className="mr-1 h-3 w-3" aria-hidden="true" />
                {project.status}
              </Badge>
            </div>
          </CardContent>

          <CardFooter className="text-muted-foreground pt-0 pb-3 text-xs">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-6">
                <IconLabel icon={Globe} label={project.region} />
                <IconLabel
                  icon={Clock}
                  label={new Date(project.createdAt).toLocaleDateString()}
                />
              </div>
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
