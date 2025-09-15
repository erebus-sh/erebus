import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (request.nextUrl.pathname.startsWith("/c")) {
    const token = await convexAuth.getToken();
    if (!token) {
      const url = new URL("/sign-in", request.url);
      url.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  // The following matcher runs middleware on all routes
  // except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
