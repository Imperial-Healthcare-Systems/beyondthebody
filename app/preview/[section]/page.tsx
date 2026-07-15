import Nav from "../../_components/Nav";
import SiteRuntime from "../../_components/SiteRuntime";
import { BEATS, VARIANTS } from "../../_sections/registry";

const ALL = [...BEATS, ...VARIANTS];

/* Isolation preview: renders ONE beat with the live motion runtime (so
   reveals + inversion behave) but no preloader/cursor, for a clean
   screenshot at [1440, 390]. Next 16: params is async. */

export function generateStaticParams() {
  return ALL.map((b) => ({ section: b.key }));
}

export default async function PreviewBeat({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
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
