"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Props = {
  slug: string;
  videoSrc?: string;
  iframeSrc?: string;
  durationSec?: number;
  poster: string;
  nextHref: string;
  nextLabel: string;
};

export function ModulePlayer({
  slug,
  videoSrc,
  iframeSrc,
  durationSec = 0,
  poster,
  nextHref,
  nextLabel,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const maxWatchedRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(`gc-mod-${slug}-completed`) === "1") {
        setCompleted(true);
        setProgress(1);
        maxWatchedRef.current = Number.POSITIVE_INFINITY;
      }
    } catch {
      /* ignore */
    }
  }, [slug]);

  // Native <video> progress tracking
  useEffect(() => {
    if (iframeSrc) return;
    const v = videoRef.current;
    if (!v) return;
    // Allow a tiny gap for normal playback jitter / frame rounding.
    const PLAY_TOLERANCE = 0.3;
    let lastTime = v.currentTime;
    let isSeeking = false;

    const onTime = () => {
      const t = v.currentTime;
      // Only advance the high-water mark during genuine forward playback,
      // never during a seek (which also fires timeupdate).
      if (
        !isSeeking &&
        t > lastTime &&
        t - lastTime <= PLAY_TOLERANCE
      ) {
        if (t > maxWatchedRef.current) maxWatchedRef.current = t;
      }
      lastTime = t;
      if (v.duration > 0) setProgress(t / v.duration);
    };
    const onSeekStart = () => {
      isSeeking = true;
      // Immediately clamp: if the target is ahead of what was watched, snap back.
      if (v.currentTime > maxWatchedRef.current) {
        v.currentTime = maxWatchedRef.current;
        lastTime = maxWatchedRef.current;
      }
    };
    const onSeeked = () => {
      // Final clamp after seek settles.
      if (v.currentTime > maxWatchedRef.current) {
        v.currentTime = maxWatchedRef.current;
        lastTime = maxWatchedRef.current;
      }
      isSeeking = false;
    };
    const onEnd = () => {
      setCompleted(true);
      setProgress(1);
      maxWatchedRef.current = Number.POSITIVE_INFINITY;
      try {
        localStorage.setItem(`gc-mod-${slug}-completed`, "1");
      } catch {
        /* ignore */
      }
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeking", onSeekStart);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("ended", onEnd);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeking", onSeekStart);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("ended", onEnd);
    };
  }, [slug, iframeSrc]);

  // iframe timer: counts seconds only while the tab is visible
  useEffect(() => {
    if (!iframeSrc || durationSec <= 0 || completed) return;
    let elapsed = 0;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      elapsed += 1;
      setProgress(Math.min(elapsed / durationSec, 1));
      if (elapsed >= durationSec) {
        setCompleted(true);
        try {
          localStorage.setItem(`gc-mod-${slug}-completed`, "1");
        } catch {
          /* ignore */
        }
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [slug, iframeSrc, durationSec, completed]);

  return (
    <div className="mp-player-col">
      <div className={"mp-player " + (completed ? "is-done" : "")}>
        {iframeSrc ? (
          <iframe
            className="mp-video"
            src={iframeSrc}
            allowFullScreen
            allow="autoplay"
            title="Video del módulo"
          />
        ) : (
          <video
            ref={videoRef}
            className="mp-video mp-video-locked"
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            disableRemotePlayback
            poster={poster}
            preload="metadata"
            playsInline
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        )}

        <div className="mp-progress" aria-hidden="true">
          <div
            className="mp-progress-bar"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        <div className="mp-player-foot">
          <div className="mp-status">
            {completed ? (
              <>
                <span className="mp-check" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="14" height="14">
                    <path
                      d="M3 8.5 L7 12 L13 4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                Capacitación completada
              </>
            ) : progress > 0 ? (
              <>Reproduciendo · {Math.round(progress * 100)}%</>
            ) : (
              <>Reproduce el video para continuar</>
            )}
          </div>

          {completed ? (
            <Link href={nextHref} className="btn btn-primary mp-cta">
              {nextLabel} <span className="btn-arrow" aria-hidden="true" />
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn-primary mp-cta is-disabled"
              aria-disabled="true"
              disabled
            >
              {nextLabel} <span className="btn-arrow" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="mp-hint">
        {iframeSrc ? (
          "El botón se habilita al terminar el video. El contador avanza solo mientras esta pestaña está activa."
        ) : (
          <>El botón <em>{nextLabel}</em> se habilita cuando termine el video.</>
        )}
      </div>

      {process.env.NODE_ENV !== "production" && (
        <button
          type="button"
          onClick={() => {
            setCompleted(true);
            setProgress(1);
            maxWatchedRef.current = Number.POSITIVE_INFINITY;
            try {
              localStorage.setItem(`gc-mod-${slug}-completed`, "1");
            } catch { /* ignore */ }
          }}
          style={{
            marginTop: "8px",
            padding: "4px 10px",
            fontSize: "11px",
            background: "#f59e0b",
            color: "#000",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            opacity: 0.8,
          }}
        >
          ⚡ Skip video (test)
        </button>
      )}
    </div>
  );
}
