/* End-to-end proof of the client's whole Journal workflow, against a production build.
 *
 * S4 makes two promises, and both are only testable on a real build — in dev Next renders
 * every page on demand, so a draft "not appearing" proves nothing about the static site:
 *
 *   1. A draft is PRIVATE. Its public address 404s, it is absent from the index, and its
 *      preview is refused to anyone not signed in.
 *   2. Publishing puts it on the STATIC site within seconds, without a deploy.
 *
 * The script writes a throwaway essay through the real editor, checks both, then archives
 * it and confirms it leaves the public site again.
 *
 *   npm run build && npm start
 *   node scripts/verify-journal.mjs <baseUrl> <magicLinkUrl>
 */

import { chromium } from "playwright";

const [baseUrl, magicLink] = process.argv.slice(2);

if (!baseUrl || !magicLink) {
  console.error("Usage: node scripts/verify-journal.mjs <baseUrl> <magicLink>");
  process.exit(1);
}

const stamp = Date.now().toString(36);
const SLUG = `zz-verify-${stamp}`;
const TITLE = `Verification essay ${stamp}`;
const SENTENCE = "This paragraph was typed into the real editor.";

let failed = false;
const check = (ok, label) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
  if (!ok) failed = true;
};

const get = async (path) => {
  const res = await fetch(`${baseUrl}${path}`, { cache: "no-store", redirect: "manual" });
  return { status: res.status, html: res.status === 200 ? await res.text() : "" };
};

/** ISR regenerates on the NEXT request after revalidatePath, so poll briefly. */
const until = async (path, predicate, tries = 12) => {
  let last;
  for (let i = 0; i < tries; i++) {
    last = await get(path);
    if (predicate(last)) return last;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return last;
};

const browser = await chromium.launch();

try {
  const page = await browser.newPage();

  /* ── Write a draft through the real form ──────────────────────────────────── */
  await page.goto(magicLink, { waitUntil: "domcontentloaded" });
  await page.goto(`${baseUrl}/admin/journal/new`, { waitUntil: "domcontentloaded" });

  if ((await page.locator("h1").first().textContent())?.trim() !== "New essay") {
    throw new Error("Not signed in — the magic link did not take.");
  }

  await page.fill("#title", TITLE);
  await page.fill("#slug", SLUG);
  await page.fill("#standfirst", "Written by the verification script.");
  await page.locator(".adm__editor").click();
  await page.keyboard.type(SENTENCE);
  await page.getByRole("button", { name: "Create draft" }).click();

  await page.waitForURL(/\/admin\/journal\/[0-9a-f-]{36}/, { timeout: 20_000 });
  const id = page.url().match(/journal\/([0-9a-f-]{36})/)[1];
  console.log(`\nDraft created: ${id}\n`);

  /* ── 1. A draft is private ────────────────────────────────────────────────── */
  console.log("A draft stays private:");

  check((await get(`/journal/${SLUG}`)).status === 404, "its public address 404s");

  const index = await get("/journal");
  check(!index.html.includes(TITLE), "it is absent from the Journal index");

  /* A separate context has no session cookie — this is a stranger with the URL. */
  const stranger = await browser.newContext();
  const strangerPage = await stranger.newPage();
  const res = await strangerPage.goto(`${baseUrl}/admin/journal/${id}/preview`, {
    waitUntil: "domcontentloaded",
  });
  check(
    strangerPage.url().includes("/admin/login") || res.status() >= 400,
    "its preview is refused to anyone not signed in"
  );
  await stranger.close();

  await page.goto(`${baseUrl}/admin/journal/${id}/preview`, { waitUntil: "domcontentloaded" });
  const previewBody = await page.locator("body").textContent();
  check(previewBody.includes(TITLE), "the signed-in client can preview it");
  check(previewBody.includes(SENTENCE), "the preview shows what was typed");

  /* ── 2. Publishing reaches the static site ────────────────────────────────── */
  console.log("\nPublishing reaches the static site:");

  await page.goto(`${baseUrl}/admin/journal/${id}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("status").first().waitFor({ timeout: 20_000 });

  const live = await until(`/journal/${SLUG}`, (r) => r.status === 200);
  check(live.status === 200, "the essay's address now serves a page");
  check(live.html.includes(SENTENCE), "the page carries the essay body");

  const listed = await until("/journal", (r) => r.html.includes(TITLE));
  check(listed.html.includes(TITLE), "the index picked it up");

  /* ── 3. And it can be withdrawn ───────────────────────────────────────────── */
  console.log("\nArchiving withdraws it again:");

  await page.goto(`${baseUrl}/admin/journal/${id}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Archive" }).click();
  await page.getByRole("status").first().waitFor({ timeout: 20_000 });

  const gone = await until(`/journal/${SLUG}`, (r) => r.status === 404);
  check(gone.status === 404, "the address 404s again");

  console.log(`\nThe verification essay is archived, not deleted — remove it with:`);
  console.log(`  delete from post where slug = '${SLUG}';`);
} catch (err) {
  console.error("\nFAIL —", err.message);
  failed = true;
} finally {
  await browser.close();
  console.log(failed ? "\nFAILED" : "\nPASS — the Journal workflow holds end to end.");
  process.exit(failed ? 1 : 0);
}
