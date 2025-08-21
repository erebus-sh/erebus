"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { GlobeIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavStackStore } from "@/stores/navigation";

export default function CreateProjectDialog() {
  const router = useRouter();
  const { pushPage } = useNavStackStore();
  const createProject = useMutation(api.projects.mutation.createProject);
  const params = useParams();
  const userSlug = params["user-slug"] as string;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [region, setRegion] = useState("global");
  const [isLoading, setIsLoading] = useState(false);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();

    if (title.trim().length < 3) {
      return; // Let HTML5 validation handle this
    }

    setIsLoading(true);

    try {
      const slug = await createProject({
        title: title.trim(),
      });

      setOpen(false);
      setTitle("");
      setRegion("global");
      toast.success("Project created successfully", {
        description: "Follow setup instructions to get started.",
      });

      const projectHref = `/c/${userSlug}/projects/${slug}`;

      pushPage({
        label: title,
        href: projectHref,
      });
      router.push(projectHref);
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error("Failed to create project", {
        description: "Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create new project</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleCreateProject}>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>
              Create a new project to start using Erebus.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Project Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My awesome project"
                required
                minLength={3}
                maxLength={100}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <GlobeIcon className="h-4 w-4" />
                Region
              </Label>
              <Select
                value={region}
                onValueChange={(val) => setRegion(val)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">
                    <div className="flex flex-row items-center justify-center gap-1">
                      <span>Global</span>
                      <span className="mx-2">•</span>
                      <span className="text-muted-foreground text-xs">
                        (Pinned near the region of the first client request)
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="eu" disabled>
                    <div className="flex flex-col">
                      <span>EU</span>
                      <span className="text-muted-foreground text-xs">
                        Coming soon
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
