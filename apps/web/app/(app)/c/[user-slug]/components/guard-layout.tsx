import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { Reason } from "@/app/enums/reason";

interface GuardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ "user-slug": string } & Record<string, string>>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function GuardLayout({
  children,
  params,
  searchParams,
}: GuardLayoutProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  console.log("params", resolvedParams);
  console.log("searchParams", resolvedSearchParams);

  const slug = resolvedParams["user-slug"];
  // Check if we're in a project route by looking for proj-slug in params
  const projectSlug = resolvedParams["proj-slug"];
  const token = await convexAuthNextjsToken();

  // Fetch user profile data
  let userWithProfileData = null;
  if (!slug) {
    redirect(`/sign-in?next=/c`);
  }

  try {
    userWithProfileData = await fetchQuery(
      api.user_profile.query.getUserProfileBySlug,
      { slug },
      { token },
    );
  } catch (error) {
    // User not found or access denied
    console.error("Error fetching user profile:", error);
  }

  // Fetch project data if project slug exists
  let projectData = null;
  if (projectSlug) {
    try {
      projectData = await fetchQuery(
        api.projects.query.getProjectBySlug,
        { slug: projectSlug },
        { token },
      );
    } catch (error) {
      // Project not found or access denied
      console.error("Error fetching project:", error);
    }
  }

  // Check user subscription status
  if (slug && userWithProfileData?.userData) {
    const { isSubscriptionActive, hasAlreadySubscribed } =
      userWithProfileData.userData;
    if (!isSubscriptionActive && !hasAlreadySubscribed) {
      redirect(`/pricing?reason=${Reason.EXPIRED}`);
    }
  }

  // Check if user exists
  if (slug && !userWithProfileData) {
    return <div>User not found</div>;
  }

  // Check if project exists (only if projectSlug was provided)
  if (projectSlug && !projectData) {
    return <div>Project not found</div>;
  }

  return <>{children}</>;
}
