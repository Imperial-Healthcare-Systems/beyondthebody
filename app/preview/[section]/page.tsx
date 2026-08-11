import { notFound } from "next/navigation";
import Nav from "../../_components/Nav";
import SiteRuntime from "../../_components/SiteRuntime";
import { BEATS, VARIANTS } from "../../_sections/registry";
import { designRoutesEnabled } from "@/lib/env";

const ALL = [...BEATS, ...VARIANTS];

/* Isolation preview: renders ONE beat with the live motion runtime (so
   reveals + inversion behave) but no preloader/cursor, for a clean
   screenshot at [1440, 390]. Next 16: params is async.

   NOT PART OF THE SITE. These are working drawings — half-finished sections and
   alternate treatments kept for comparison — and in production they are nothing but a
   way for a stranger to find work that was never signed off. Off unless DESIGN_ROUTES
   says otherwise; nothing is prerendered, and a direct request 404s like any other
   address that does not exist. */

export function generateStaticParams() {
  if (!designRoutesEnabled()) return [];
  return ALL.map((b) => ({ section: b.key }));
}

export default async function PreviewBeat({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  if (!designRoutesEnabled()) notFound();

  const { section } = await params;
  const beat = ALL.find((b) => b.key === section);

  if (!beat) {
    return (
      <main style={{ padding: 80, fontFamily: "sans-serif", color: "#E2CBA6" }}>
        Unknown beat: <code>{section}</code>
        <br />
        Available: {BEATS.map((b) => b.key).join(", ") || "(none yet)"}
      </main>
    );
  }

  const C = beat.Component;
  return (
    <>
      <Nav />
      <main id="top">
        <C />
      </main>
      <SiteRuntime />
    </>
  );
}
