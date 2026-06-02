import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Logout: clears the session cookie. Because the session is a self-contained
 * signed cookie (no server-side token store), clearing the cookie ends the
 * session immediately for this browser.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  return clearSessionCookie(res);
}
