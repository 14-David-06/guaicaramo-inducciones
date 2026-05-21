import { NextRequest, NextResponse } from "next/server";

const OLD_HOST = "guaicaramo-inducciones.vercel.app";
const NEW_URL = "https://guaicaramo-inducciones-reinducciones.vercel.app/";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  if (host === OLD_HOST) {
    // Keep the URL in the browser address bar but serve the /moved page
    const moved = new URL("/moved", request.url);
    return NextResponse.rewrite(moved);
  }

  return NextResponse.next();
}

export const config = {
  // Run on every route except Next.js internals and static assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
