"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export default function CreateNewKeyDialog() {
  const createKey = useMutation(api.keys.mutation.createKey);
  const params = useParams();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dev, setDev] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Get projectId from params
  const projectSlug = params["proj-slug"] as string;

  // For demo, assume projectId is passed as a prop or from params
  // In a real app, you may need to fetch the Convex ID for the project from the slug

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();

    if (title.trim().length < 3) {
      return; // Let HTML5 validation handle this
    }

    if (!projectSlug) {
      toast.error("Project not found", {
        description: "Could not determine project ID.",
      });
      return;
    }

    setIsLoading(true);

    try {
      // No need to grab value as useQuery will update on insert
      await createKey({
        title: title.trim(),
        projectSlug: projectSlug,
        dev,
      });

      setOpen(false);
      setTitle("");
      setDev(false);
      toast.success("Key created successfully", {
        description: "Copy your new API key and store it securely.",
      });
    } catch (error) {
      console.error("Failed to create key:", error);
      toast.error("Failed to create key", {
        description: "Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create new key</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleCreateKey}>
          <DialogHeader>
            <DialogTitle>New API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for this project. You can choose a label and
              environment.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Key Label */}
            <div className="grid gap-2">
              <Label htmlFor="title">Key Label</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My dev key"
                required
                minLength={3}
                maxLength={100}
                disabled={isLoading}
              />
            </div>
            {/* Environment */}
            <div className="grid gap-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                Environment
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="text-muted-foreground h-4 w-4 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-lg text-xs">
                      <p>
                        Currently, there is no performance or literal difference
                        between development and production environments. This
                        separation exists for security best practices and key
                        organization purposes only.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>

              <Select
                value={dev ? "dev" : "prod"}
                onValueChange={(val) => {
                  setDev(val === "dev");
                  // console.log(`[CreateNewKeyDialog] Environment changed to: ${val}`);
                }}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prod">
                    <span>Production</span>
                  </SelectItem>
                  <SelectItem value="dev">
                    <span>Development</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>
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
                "Create Key"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
