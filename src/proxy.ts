import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  COOKIE_NAME,
  readSessionCookieValue,
  sessionCookieOptions,
  slideSessionCookieValue,
} from "@/lib/session-cookie";

const OLD_HOST = "guaicaramo-inducciones.vercel.app";

export const config = {
  matcher: [
    // Match every path except Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const host = req.headers.get("host") ?? "";

  // Old domain → show the "moved" page for every route
  if (host === OLD_HOST) {
    const moved = new URL("/moved", req.url);
    return NextResponse.rewrite(moved);
  }

  // Auth guard for module routes
  if (req.nextUrl.pathname.startsWith("/modulos")) {
    const cookieValue = req.cookies.get(COOKIE_NAME)?.value;
    const session = await readSessionCookieValue(cookieValue);

    if (session.status === "valid") {
      // Active request → slide the inactivity window forward (silent renewal).
      const res = NextResponse.next();
      const renewed = await slideSessionCookieValue(session.issuedAt);
      res.cookies.set(COOKIE_NAME, renewed, sessionCookieOptions());
      return res;
    }

    // No / expired / inactive session — redirect home with a reason so the
    // login modal can open and explain why the session ended.
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("login", "1");
    url.searchParams.set("next", req.nextUrl.pathname);
    if (session.status === "inactive") url.searchParams.set("reason", "inactive");
    else if (session.status === "expired") url.searchParams.set("reason", "expired");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

