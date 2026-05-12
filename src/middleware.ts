import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionCookieValue } from "@/lib/session-cookie";

export const config = {
  matcher: ["/modulos/:path*"],
};

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const cookieValue = req.cookies.get(COOKIE_NAME)?.value;

  if (cookieValue && (await verifySessionCookieValue(cookieValue))) {
    return NextResponse.next();
  }

  // No session — redirect to home with a flag so the login modal opens
  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("login", "1");
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}
