"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQueryWithState } from "@/utils/query";
import { api } from "@/convex/_generated/api";
import SidesLayout from "../components/sides-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Globe, Edit } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";

export default function SettingsPage() {
  const params = useParams();
  const projectSlug = params["proj-slug"] as string;

  // State for form inputs
  const [projectName, setProjectName] = useState("");
  const [webhookDomain, setWebhookDomain] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isUpdatingWebhook, setIsUpdatingWebhook] = useState(false);
  const [webhookValidation, setWebhookValidation] = useState<{
    isValid: boolean;
    message: string;
  }>({ isValid: true, message: "" });

  // Query to get current project data
  const {
    data: project,
    isPending,
    error,
  } = useQueryWithState(api.projects.query.getProjectBySlug, {
    slug: projectSlug,
  });

  // Mutations
  const updateProjectName = useMutation(
    api.projects.mutation.updateProjectName,
  );
  const updateProjectWebhookUrl = useMutation(
    api.projects.mutation.updateProjectWebhookUrl,
  );

  // Initialize form values when project data loads
  useEffect(() => {
    if (project) {
      setProjectName(project.title);
      setWebhookDomain(project.webhookUrl || "");
    }
  }, [project]);

  // Real-time webhook URL validation
  const validateWebhookUrl = (url: string) => {
    if (url.trim() === "") {
      setWebhookValidation({ isValid: true, message: "" });
      return;
    }

    try {
      const parsedUrl = new URL(url);

      // Must be HTTPS
      if (parsedUrl.protocol !== "https:") {
        setWebhookValidation({
          isValid: false,
          message: "Must use HTTPS protocol",
        });
        return;
      }

      // Must have a valid hostname
      if (!parsedUrl.hostname || parsedUrl.hostname.length < 3) {
        setWebhookValidation({
          isValid: false,
          message: "Must have a valid domain name",
        });
        return;
      }

      // Hostname must contain at least one dot (for domain)
      if (!parsedUrl.hostname.includes(".")) {
        setWebhookValidation({
          isValid: false,
          message: "Must have a valid domain name",
        });
        return;
      }

      // Check if it's a base URL (no path or just trailing slash)
      const pathname = parsedUrl.pathname;
      if (pathname && pathname !== "/" && pathname.length > 1) {
        setWebhookValidation({
          isValid: false,
          message: "Only base URLs allowed (e.g., https://example.com)",
        });
        return;
      }

      setWebhookValidation({ isValid: true, message: "Valid webhook URL" });
    } catch (error: unknown) {
      setWebhookValidation({
        isValid: false,
        message: "Invalid URL format",
      });
      console.error(error);
    }
  };

  // Handle webhook URL input change with real-time validation
  const handleWebhookChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setWebhookDomain(value);
    validateWebhookUrl(value);
  };

  const handleUpdateProjectName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || projectName === project?.title) return;

    setIsUpdatingName(true);
    try {
      await updateProjectName({
        projectSlug,
        title: projectName.trim(),
      });
      toast.success("Project name updated successfully");
    } catch (error) {
      toast.error("Failed to update project name");
      console.error(error);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleUpdateWebhookDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (webhookDomain === (project?.webhookUrl || "")) return;

    // Don't submit if validation fails
    if (!webhookValidation.isValid) {
      toast.error("Please fix the webhook URL format before saving");
      return;
    }

    setIsUpdatingWebhook(true);
    try {
      await updateProjectWebhookUrl({
        projectSlug,
        webhookUrl: webhookDomain,
      });
      toast.success("Webhook URL updated successfully");
    } catch (error) {
      toast.error("Failed to update webhook URL");
      console.error(error);
    } finally {
      setIsUpdatingWebhook(false);
    }
  };

  if (error) {
    return (
      <SidesLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Project Settings
            </h1>
            <p className="text-muted-foreground">
              Manage your project configuration and preferences
            </p>
          </div>
          <Card>
            <CardContent className="flex items-center justify-center h-[300px]">
              <div className="text-center space-y-3">
                <div className="text-destructive font-medium">
                  Failed to load project settings
                </div>
                <div className="text-sm text-muted-foreground">
                  {error.message}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </SidesLayout>
    );
  }

  if (isPending) {
    return (
      <SidesLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Project Settings
            </h1>
            <p className="text-muted-foreground">
              Manage your project configuration and preferences
            </p>
          </div>
          <div className="space-y-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-5 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                    <div className="h-10 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="h-9 w-20 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </SidesLayout>
    );
  }

  return (
    <SidesLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6" />
            <h1 className="text-2xl font-bold tracking-tight">
              Project Settings
            </h1>
          </div>
          <p className="text-muted-foreground">
            Manage your project configuration and preferences
          </p>
        </div>

        {/* Project Name Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Project Name
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Update your project&apos;s display name. This will be visible
              throughout the dashboard.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProjectName} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                  minLength={3}
                  maxLength={100}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Must be between 3 and 100 characters long.
                </p>
              </div>
              <Button
                type="submit"
                disabled={
                  isUpdatingName ||
                  !projectName.trim() ||
                  projectName === project?.title
                }
                className="w-fit"
              >
                {isUpdatingName ? "Updating..." : "Update Project Name"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Webhook Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Webhook URL
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure the webhook endpoint URL for storing and preserving
              message flow in your project scope. Messages will be forwarded to
              this endpoint for further processing or archival. Must be a valid
              base HTTPS URL (e.g., https://example.com).
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateWebhookDomain} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-domain">Webhook URL</Label>
                <Input
                  id="webhook-domain"
                  value={webhookDomain}
                  onChange={handleWebhookChange}
                  placeholder="https://example.com"
                  type="url"
                  className={
                    webhookDomain && !webhookValidation.isValid
                      ? "border-destructive"
                      : ""
                  }
                />
                {webhookDomain && (
                  <p
                    className={`text-xs ${webhookValidation.isValid ? "text-green-600" : "text-destructive"}`}
                  >
                    {webhookValidation.message}
                  </p>
                )}
                {!webhookDomain && (
                  <p className="text-xs text-muted-foreground">
                    Enter a valid base HTTPS URL (e.g., https://example.com) to
                    receive message flow data. Leave empty to disable webhook
                    forwarding.
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={
                  isUpdatingWebhook ||
                  webhookDomain === (project?.webhookUrl || "") ||
                  (webhookDomain !== "" && !webhookValidation.isValid)
                }
                className="w-fit"
              >
                {isUpdatingWebhook ? "Updating..." : "Update Webhook URL"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Additional Project Info */}
        {project && (
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Project Slug:
                </span>
                <span className="text-sm font-mono">{project.slug}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Created:</span>
                <span className="text-sm">
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status:</span>
                <span className="text-sm capitalize">{project.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Region:</span>
                <span className="text-sm capitalize">{project.region}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SidesLayout>
  );
}
