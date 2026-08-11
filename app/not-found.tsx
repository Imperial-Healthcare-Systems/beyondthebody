import type { Metadata } from "next";
import Nav from "./_components/Nav";
import SiteRuntime from "./_components/SiteRuntime";
import Footer from "./_sections/Footer";
import "./_sections/legal.css";

/* The 404.
 *
 * It carries the full chrome — nav, footer, the house list — because someone who has
 * mistyped an address or followed a dead link is not a dead end, they are a visitor
 * standing in the wrong room. The useful thing is a way onward, not an apology.
 *
 * No Preloader. The curtain exists to hide entrance animations that have not started yet,
 * and there is nothing here to animate; a curtain would only delay the one thing this page
 * is for.
 *
 * Reached by every unmatched address, and by notFound() from the routes that call it —
 * a draft essay's public address, a stranger's order token, /preview in production. All of
 * those must look identical from outside: an address that does not exist tells you nothing
 * about whether it once did. */

export const metadata: Metadata = {
  title: "Not found — Beyond The Body",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="top">
        <section className="lg" data-theme="light">
          <div className="lg__inner">
            <p className="lg__eyebrow">404</p>
            <h1 className="lg__title">This address doesn&rsquo;t exist.</h1>
            <div className="lg__body" style={{ marginTop: 24 }}>
              <p>
                It may have been a mistyped address, or something that has since moved. The
                house is still here.
              </p>
              <ul>
                <li>
                  <a href="/">The house</a> — where everything begins
                </li>
                <li>
                  <a href="/collection">The collection</a> — four unisex fragrances
                </li>
                <li>
                  <a href="/journal">The Journal</a> — scent as culture
                </li>
                <li>
                  <a href="/contact">Contact</a> — if you were looking for a person
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <SiteRuntime />
    </>
  );
}
