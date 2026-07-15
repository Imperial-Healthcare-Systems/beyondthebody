import Preloader from "./_components/Preloader";
import Cursor from "./_components/Cursor";
import Nav from "./_components/Nav";
import SiteRuntime from "./_components/SiteRuntime";
import { BEATS } from "./_sections/registry";

export default function Home() {
  return (
    <>
      <Preloader />
      <Cursor />
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
