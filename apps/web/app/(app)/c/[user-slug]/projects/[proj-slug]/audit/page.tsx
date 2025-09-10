"use client";

import { useQueryWithState } from "@/utils/query";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import Audit from "@/components/audit";
import Spinner from "@/components/spinner";
import SidesLayout from "../components/sides-layout";

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

  if (isPending) {
    return <Spinner />;
  }

  if (
    (isError &&
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      (error as { message: string }).message.includes("No audit logs found")) ||
    (Array.isArray(auditLogs) && auditLogs.length === 0)
  ) {
    return (
      <div className="text-muted-foreground">
        There are no audit logs yet. Once there are changes, they will be shown
        right here.
      </div>
    );
  }

  if (isError || !auditLogs) {
    return <div className="text-red-500">Failed to load audit logs.</div>;
  }

  return (
    <SidesLayout>
      <div className="space-y-6">
        <Audit items={auditLogs} />
      </div>{" "}
    </SidesLayout>
  );
}
