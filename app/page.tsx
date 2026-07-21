import Preloader from "./_components/Preloader";
import Nav from "./_components/Nav";
import SiteRuntime from "./_components/SiteRuntime";
import { BEATS } from "./_sections/registry";

// Cursor is now mounted once, site-wide, in app/layout.tsx (was here) so it renders on every route.
export default function Home() {
  return (
    <>
      {/* `intro` = this route may hand the curtain over to the INTRO REEL.
          The Preloader still decides whether it actually does (desktop, motion
          allowed, once per session). */}
      <Preloader intro />
      <Nav />
      <main id="top">
        {BEATS.map((b) => {
          const C = b.Component;
          return <C key={b.key} />;
        })}
      </main>
      <SiteRuntime />
    </>
  );
}
