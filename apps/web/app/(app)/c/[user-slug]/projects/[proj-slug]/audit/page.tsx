"use client";

import { useQueryWithState } from "@/utils/query";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import Audit from "@/components/audit";
import Spinner from "@/components/spinner";
import SidesLayout from "../components/sides-layout";
import { ScrollText } from "lucide-react";
import Link from "next/link";

export default function AuditPage() {
  const params = useParams();
  const projectSlug = params["proj-slug"] as string;
  const {
    data: auditLogs,
    isPending,
    isError,
    error,
  } = useQueryWithState(api.audit_log.query.getAuditLogsForProject, {
    projectSlug: projectSlug,
  });

  if (isError && !(error as any)?.message?.includes("No audit logs found")) {
    return (
      <SidesLayout>
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground mb-2">
            Track all changes and activities in your project with detailed audit
            logs.
          </p>
        </div>
        <div className="text-red-500">
          Oops... Error loading audit logs. If this continues, please contact
          support at hey@v0id.me
        </div>
      </SidesLayout>
    );
  }

  if (
    !auditLogs ||
    auditLogs.length === 0 ||
    (isError &&
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      (error as { message: string }).message.includes("No audit logs found"))
  ) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        {isPending && <Spinner />}
        {!isPending && (
          <>
            <div className="bg-muted mx-auto flex h-20 w-20 items-center justify-center rounded-full">
              <ScrollText className="text-muted-foreground h-10 w-10" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">No audit logs yet</h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm">
              There are no audit logs yet. Once there are changes like API key
              creation, updates, or other project activities, they will be shown
              right here.
            </p>
            <div className="text-muted-foreground mt-8 text-xs">
              <p>
                Need help? Check out our{" "}
                <a
                  href={process.env.NEXT_PUBLIC_DOCS_URL}
                  className="hover:text-foreground underline"
                >
                  documentation
                </a>{" "}
                for more information about audit logs.
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <SidesLayout>
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground mb-2">
          Track all changes and activities in your project with detailed audit
          logs. Every API key creation, modification, and other important
          actions are recorded here.
        </p>
        <p className="text-muted-foreground text-sm">
          Learn more about{" "}
          <Link
            href={`${process.env.NEXT_PUBLIC_DOCS_URL}/audit-logs`}
            className="hover:text-foreground underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            audit logs and security tracking
          </Link>{" "}
          in our documentation.
        </p>
      </div>

      {isPending && <Spinner />}
      {!isPending && auditLogs && (
        <div className="space-y-6">
          <Audit items={auditLogs} />
        </div>
      )}
    </SidesLayout>
  );
}
