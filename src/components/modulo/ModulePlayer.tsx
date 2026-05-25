"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Props = {
  slug: string;
  videoSrc: string;
  poster: string;
  nextHref: string;
  nextLabel: string;
};

export function ModulePlayer({
  slug,
  videoSrc,
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

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const SEEK_TOLERANCE = 0.75; // max delta accepted as continuous playback
    let lastTime = v.currentTime;
    const onTime = () => {
      const t = v.currentTime;
      // Only advance the watched marker on continuous playback (small forward delta).
      if (t > lastTime && t - lastTime <= SEEK_TOLERANCE) {
        if (t > maxWatchedRef.current) maxWatchedRef.current = t;
      }
      lastTime = t;
      if (v.duration > 0) setProgress(t / v.duration);
    };
    const clampSeek = () => {
      // Allow seeking backward freely; block seeking past the furthest watched point.
      if (v.currentTime > maxWatchedRef.current + SEEK_TOLERANCE) {
        v.currentTime = maxWatchedRef.current;
        lastTime = maxWatchedRef.current;
      }
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
    v.addEventListener("seeking", clampSeek);
    v.addEventListener("seeked", clampSeek);
    v.addEventListener("ended", onEnd);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeking", clampSeek);
      v.removeEventListener("seeked", clampSeek);
      v.removeEventListener("ended", onEnd);
    };
  }, [slug]);

  return (
    <div className="mp-player-col">
      <div className={"mp-player " + (completed ? "is-done" : "")}>
        <video
          ref={videoRef}
          className="mp-video"
          controls
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          poster={poster}
          preload="metadata"
          playsInline
        >
          <source src={videoSrc} type="video/mp4" />
        </video>

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
        El botón <em>{nextLabel}</em> se habilita cuando termine el video.
      </div>
    </div>
  );
}
