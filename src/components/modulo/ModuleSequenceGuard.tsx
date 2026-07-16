"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MODULES } from "@/lib/modules-data";

export function ModuleSequenceGuard({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    const idx = MODULES.findIndex((m) => m.slug === slug);
    if (idx <= 0) return; // first module is always accessible
    try {
      // Todos los módulos anteriores deben estar completados, no solo el previo.
      const faltaAlguno = MODULES.slice(0, idx).some(
        (m) => localStorage.getItem(`gc-mod-${m.slug}-completed`) !== "1",
      );
      if (faltaAlguno) {
        router.replace("/#modulos");
      }
    } catch {
      /* ignore */
    }
  }, [slug, router]);

  return null;
}
