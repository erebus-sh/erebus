"use client";

import { useState } from "react";
import { Eye, EyeOff, Trash2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import Link from "next/link";
import CreateNewKeyDialog from "./components/create-new-key-dialog";
import { Doc } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { useQueryWithState } from "@/utils/query";
import { useParams } from "next/navigation";
import Spinner from "@/components/spinner";

function formatDate(timestamp: number) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function ApiKeyCard({ apiKey }: { apiKey: Doc<"api_keys"> }) {
  const [show, setShow] = useState(false);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-row items-center justify-between gap-2 text-base">
          <span className="text-muted-foreground text-xs font-medium">
            API Key:
          </span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline">
              Settings
            </Button>
            <Button type="button" size="sm" variant="destructive">
              <Trash2 className="mr-1 h-4 w-4" />
              Revoke key
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-sm select-all">
              {show
                ? apiKey.key
                : apiKey.key.slice(0, 10) +
                  "*".repeat(Math.max(0, apiKey.key.length - 10))}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="px-2"
              onClick={() => setShow((s) => !s)}
            >
              {show ? (
                <>
                  <EyeOff className="mr-1 h-4 w-4" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="mr-1 h-4 w-4" />
                  Show
                </>
              )}
            </Button>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="text-muted-foreground mb-1 text-xs font-medium">
              Grants of interactions
            </div>
            <div className="text-sm break-words">
              {/* {formatScope(apiKey.scope as "read-write" | "write" | "read")} */}
              Read & Write
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1 text-xs font-medium">
              <span className="text-muted">
                Resource restrictions (channels & queues):
              </span>
            </div>
            <div className="text-muted text-sm italic opacity-60">(soon)</div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="text-muted-foreground flex flex-wrap gap-6 text-xs">
          <div>
            <span className="font-medium">Created</span>
            <span className="ml-2">{formatDate(apiKey.createdAt)}</span>
          </div>
          <div>
            <span className="font-medium">Name</span>
            <span className="ml-2">
              {apiKey.label ? (
                apiKey.label
              ) : (
                <span className="text-muted-foreground italic">N/A</span>
              )}
            </span>
          </div>
          <div>
            <span className="font-medium">Environment</span>
            <span
              className={`ml-2 font-semibold ${
                apiKey.key.startsWith("dv-er-")
                  ? "text-blue-600"
                  : "text-green-600"
              }`}
            >
              {apiKey.key.startsWith("dv-er-") ? "Development" : "Production"}
            </span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

export default function KeysPage() {
  const params = useParams();
  const projectSlug = params["proj-slug"] as string;
  const {
    data: apiKeys,
    isPending,
    isError,
  } = useQueryWithState(api.keys.query.getKeyByProjectSlug, {
    projectSlug: projectSlug,
  });
  const hasKeys = apiKeys && apiKeys.length > 0;

  if (isError) {
    return (
      <div>
        Oops... something went wrong, please contact hey@v0id.me or just refresh
        the page.
      </div>
    );
  }

  if (!apiKeys || apiKeys.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        {isPending && <Spinner />}
        {!isPending && (
          <>
            <div className="bg-muted mx-auto flex h-20 w-20 items-center justify-center rounded-full">
              <KeyRound className="text-muted-foreground h-10 w-10" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">No API keys yet</h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm">
              Get started by creating your first API key. Securely connect your
              apps and services to Erebus.
            </p>
            <div className="mt-6">
              <CreateNewKeyDialog />
            </div>
            <div className="text-muted-foreground mt-8 text-xs">
              <p>
                Need help? Check out our{" "}
                <a
                  href={process.env.NEXT_PUBLIC_DOCS_URL}
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
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold tracking-tight">
          Your API Keys
        </h1>
        <p className="text-muted-foreground mb-2">
          API Keys are secret strings your server uses to let your users connect
          to your WebSockets infra with the right permissions.
        </p>
        <p className="text-muted-foreground text-sm">
          Please check out our{" "}
          <Link
            href={`${process.env.NEXT_PUBLIC_DOCS_URL}/api-keys-and-authentication`}
            className="hover:text-foreground underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            API Keys and Authentication guide
          </Link>{" "}
          to better understand the underlying model.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={`${process.env.NEXT_PUBLIC_DOCS_URL}/api-keys-and-authentication`}
            className="hover:text-foreground text-sm font-medium underline"
          >
            How to use API Keys
          </Link>
        </div>
        <CreateNewKeyDialog />
      </div>

      {isPending && <Spinner />}
      {!isPending && hasKeys && (
        <div>
          {apiKeys.map((apiKey) => (
            <ApiKeyCard key={apiKey._id} apiKey={apiKey} />
          ))}
        </div>
      )}
    </div>
  );
}
