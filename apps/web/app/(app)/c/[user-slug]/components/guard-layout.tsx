import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";

interface GuardLayoutProps {
  children: React.ReactNode;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function GuardLayout({
  children,
  searchParams,
}: GuardLayoutProps) {
  const slug = (await searchParams)["user-slug"] as string;
  const projectSlug = (await searchParams)["proj-slug"] as string;
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
  if (!projectSlug) {
    redirect(`/sign-in?next=/c`);
  }

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

  // Check user subscription status
  if (slug && userWithProfileData?.userData) {
    const { isSubscriptionActive, hasAlreadySubscribed } =
      userWithProfileData.userData;
    if (!isSubscriptionActive && !hasAlreadySubscribed) {
      redirect(`/pricing?expired=true`);
    }
  }

  // Check if user exists
  if (slug && !userWithProfileData) {
    return <div>User not found</div>;
  }

  // Check if project exists
  if (projectSlug && !projectData) {
    return <div>Project not found</div>;
  }

  return <>{children}</>;
}
