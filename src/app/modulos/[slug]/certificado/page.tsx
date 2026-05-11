import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { MODULES } from "@/lib/modules-data";
import { Certificate } from "@/components/modulo/Certificate";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return MODULES.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const m = MODULES.find((x) => x.slug === slug);
  if (!m) return {};
  return {
    title: `Certificado · ${m.num} ${m.title} · Guaicaramo`,
    description: `Certificado del módulo ${m.num} ${m.title}.`,
  };
}

export default async function CertPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const m = MODULES.find((x) => x.slug === slug);
  if (!m) notFound();

  return (
    <main className="cert-shell">
      <Certificate slug={slug} />
    </main>
  );
}
