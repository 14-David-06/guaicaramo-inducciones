"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MODULES } from "@/lib/modules-data";

export function ModuleSequenceGuard({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    const idx = MODULES.findIndex((m) => m.slug === slug);
    if (idx <= 0) return; // first module is always accessible
    const prevSlug = MODULES[idx - 1].slug;
    try {
      if (localStorage.getItem(`gc-mod-${prevSlug}-completed`) !== "1") {
        router.replace("/#modulos");
      }
    } catch {
      /* ignore */
    }
  }, [slug, router]);

  return null;
}
