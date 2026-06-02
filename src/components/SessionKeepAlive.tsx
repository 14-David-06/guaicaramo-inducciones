"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps the (httpOnly cookie) session alive while the user is active.
 *
 * The access credential is an httpOnly cookie, so JS can't read its expiry.
 * Instead we observe real user activity (pointer, keyboard, scroll, touch) and
 * call /api/auth/refresh preventively — throttled — to slide the 60-minute
 * inactivity window forward. If the server reports the session already lapsed
 * (SESSION_INACTIVE / TOKEN_EXPIRED), we redirect to the login with a reason so
 * the user sees an explanatory message.
 *
 * Mount this only inside authenticated areas (e.g. /modulos pages).
 */

// Don't hammer the endpoint: at most one refresh per this interval.
const REFRESH_THROTTLE_MS = 5 * 60 * 1000; // 5 min
// Safety net: refresh on a timer too, in case the user is reading without
// generating input events.
const HEARTBEAT_MS = 5 * 60 * 1000; // 5 min

const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "scroll",
  "touchstart",
  "mousemove",
] as const;

export function SessionKeepAlive() {
  const lastRefresh = useRef(0);
  const inFlight = useRef(false);
  const redirected = useRef(false);

  useEffect(() => {
    function redirectToLogin(reason: string) {
      if (redirected.current) return;
      redirected.current = true;
      const next = window.location.pathname;
      window.location.href = `/?login=1&reason=${reason}&next=${encodeURIComponent(next)}`;
    }

    async function refresh() {
      if (inFlight.current || redirected.current) return;
      const now = Date.now();
      if (now - lastRefresh.current < REFRESH_THROTTLE_MS) return;
      lastRefresh.current = now;
      inFlight.current = true;
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
        });
        if (res.status === 401) {
          let code = "";
          try {
            code = ((await res.json()) as { code?: string }).code ?? "";
          } catch {
            /* ignore parse errors */
          }
          if (code === "SESSION_INACTIVE") redirectToLogin("inactive");
          else if (code === "TOKEN_EXPIRED") redirectToLogin("expired");
          else redirectToLogin("required");
        }
      } catch {
        /* network blip — try again on the next activity tick */
      } finally {
        inFlight.current = false;
      }
    }

    function onActivity() {
      void refresh();
    }

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }
    const heartbeat = window.setInterval(() => void refresh(), HEARTBEAT_MS);

    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
      window.clearInterval(heartbeat);
    };
  }, []);

  return null;
}
