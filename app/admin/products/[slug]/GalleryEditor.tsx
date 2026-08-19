"use client";

/* The gallery editor for one product.
 *
 * Every control is a plain form posting a Server Action — no drag-and-drop, no client-side
 * ordering state, no optimistic list that can disagree with the database. The gallery is
 * three or four images; two arrow buttons do the job, work on a phone, and cannot get out
 * of sync with what is actually stored.
 *
 * One shared action-state per KIND of operation rather than per row: the panel only ever
 * reports the last thing that happened, and per-row state would mean four idle reducers
 * waiting to contradict each other.
 */

import { useActionState, useRef, useState } from "react";
import {
  addImageAction,
  moveImageAction,
  removeImageAction,
  resetGalleryAction,
  updateAltAction,
  type GalleryFormState,
} from "../actions";

export type EditorImage = {
  id: string;
  path: string;
  alt: string;
  width: number;
  height: number;
  bytes: number | null;
};

type Props = {
  slug: string;
  productName: string;
  /** Rows from the database. Empty means the product is still on its build-time images. */
  images: EditorImage[];
  /** What the site shows when `images` is empty — rendered so the client can see what
      "the original images" actually are before they replace them. */
  fallback: { src: string; alt: string }[];
  maxMb: number;
};

function Result({ state }: { state: GalleryFormState }) {
  if (state.error)
    return (
      <p className="adm__error" role="alert">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" style={{ color: "#4a6b46", fontSize: 13 }}>
        {state.ok}
      </p>
    );
  return null;
}

export default function GalleryEditor({ slug, productName, images, fallback, maxMb }: Props) {
  const [addState, addAction, adding] = useActionState<GalleryFormState, FormData>(
    addImageAction,
    {}
  );
  const [rowState, rowAction, rowPending] = useActionState<GalleryFormState, FormData>(
    async (prev: GalleryFormState, formData: FormData) => {
      /* One reducer for the three row operations, chosen by the submitter's own name/value —
         the same trick the order transition buttons use, and it keeps three near-identical
         useActionState triples out of the component. */
      const op = formData.get("op");
      if (op === "move") return moveImageAction(prev, formData);
      if (op === "remove") return removeImageAction(prev, formData);
      return updateAltAction(prev, formData);
    },
    {}
  );
  const [resetState, resetAction, resetting] = useActionState<GalleryFormState, FormData>(
    resetGalleryAction,
    {}
  );

  const fileRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const custom = images.length > 0;

  return (
    <>
      <section className="adm__panel">
        <p className="adm__label" style={{ marginBottom: 6 }}>
          {custom ? "Your images" : "The images this product shipped with"}
        </p>
        <p className="adm__note" style={{ margin: "0 0 18px" }}>
          {custom ? (
            <>
              The first one is what the page opens on. {productName} is showing these instead
              of its original images.
            </>
          ) : (
            <>
              Nothing has been uploaded for {productName}, so the page still shows these.
              Uploading one image replaces all of them.
            </>
          )}
        </p>

        {custom ? (
          <ul className="adm__gallery">
            {images.map((im, i) => (
              <li className="adm__shot" key={im.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="adm__shotimg" src={im.path} alt="" />

                <div className="adm__shotbody">
                  <p className="adm__shotmeta">
                    {i === 0 && <span className="adm__tag adm__tag--confirmed">Opens on this</span>}{" "}
                    {im.width} × {im.height}
                    {im.bytes ? ` · ${Math.round(im.bytes / 1024)} KB` : ""}
                  </p>

                  <form action={rowAction} className="adm__row">
                    <input type="hidden" name="op" value="alt" />
                    <input type="hidden" name="id" value={im.id} />
                    <label className="adm__field" style={{ margin: 0, flex: "1 1 240px" }}>
                      <span className="adm__label">
                        Description (read aloud to people who can&rsquo;t see it)
                      </span>
                      <input
                        className="adm__input"
                        name="alt"
                        defaultValue={im.alt}
                        maxLength={300}
                        disabled={rowPending}
                      />
                    </label>
                    <button className="adm__btn adm__btn--ghost" type="submit" disabled={rowPending}>
                      Save
                    </button>
                  </form>

                  <div className="adm__row" style={{ marginTop: 10 }}>
                    <form action={rowAction}>
                      <input type="hidden" name="op" value="move" />
                      <input type="hidden" name="id" value={im.id} />
                      <input type="hidden" name="dir" value="up" />
                      <button
                        className="adm__btn adm__btn--ghost"
                        type="submit"
                        disabled={rowPending || i === 0}
                        aria-label={`Move image ${i + 1} earlier`}
                      >
                        ↑ Earlier
                      </button>
                    </form>
                    <form action={rowAction}>
                      <input type="hidden" name="op" value="move" />
                      <input type="hidden" name="id" value={im.id} />
                      <input type="hidden" name="dir" value="down" />
                      <button
                        className="adm__btn adm__btn--ghost"
                        type="submit"
                        disabled={rowPending || i === images.length - 1}
                        aria-label={`Move image ${i + 1} later`}
                      >
                        ↓ Later
                      </button>
                    </form>
                    <form action={rowAction}>
                      <input type="hidden" name="op" value="remove" />
                      <input type="hidden" name="id" value={im.id} />
                      <button
                        className="adm__btn adm__btn--ghost"
                        type="submit"
                        disabled={rowPending}
                        onClick={(e) => {
                          if (!window.confirm("Remove this image from the product page?")) {
                            e.preventDefault();
                          }
                        }}
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="adm__gallery">
            {fallback.map((f) => (
              <li className="adm__shot" key={f.src}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="adm__shotimg" src={f.src} alt="" />
                <div className="adm__shotbody">
                  <p className="adm__shotmeta">{f.alt}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Result state={rowState} />
      </section>

      <section className="adm__panel">
        <p className="adm__label" style={{ marginBottom: 6 }}>
          Add an image
        </p>
        <p className="adm__note" style={{ margin: "0 0 16px" }}>
          Straight off the camera is fine &mdash; up to {maxMb}MB, any common format. It gets
          resized and converted for the web on the way in, so there is nothing to prepare.
        </p>
        {/* The hero frame is a fixed square that letterboxes rather than crops (pdphero.css),
            so nothing gets cut off — but a long thin picture sits in a lot of empty frame,
            and the client should know that before uploading rather than after. */}
        <p className="adm__note" style={{ margin: "0 0 16px" }}>
          The product page shows pictures in a square frame. Nothing is ever cropped, so a wide
          or tall picture will simply have space around it &mdash; roughly square ones fill the
          frame best.
        </p>

        <form action={addAction}>
          <input type="hidden" name="slug" value={slug} />

          <div className="adm__field">
            <span className="adm__label">Picture</span>
            <input
              ref={fileRef}
              className="adm__input"
              type="file"
              name="file"
              accept="image/*"
              required
              disabled={adding}
              onChange={(e) => setPicked(e.currentTarget.files?.[0]?.name ?? null)}
            />
          </div>

          <div className="adm__field" style={{ maxWidth: 520 }}>
            <span className="adm__label">
              Description (optional &mdash; read aloud to people who can&rsquo;t see it)
            </span>
            <input
              className="adm__input"
              name="alt"
              maxLength={300}
              placeholder={`${productName} — the flacon in warm directional light`}
              disabled={adding}
            />
          </div>

          <div className="adm__row">
            <button className="adm__btn" type="submit" disabled={adding}>
              {adding ? "Uploading…" : "Add to the page"}
            </button>
            {picked && !adding && (
              <span className="adm__note" style={{ margin: 0 }}>
                {picked}
              </span>
            )}
          </div>

          <Result state={addState} />
        </form>
      </section>

      {/* Mounted while there is something to SAY, not only while there is something to
          press. Resetting succeeds by emptying the gallery, which flips `custom` false — so
          a panel guarded on `custom` alone would unmount at the exact moment it had good
          news, and the client would see the button vanish with no confirmation that
          anything had happened. Same trap the order controls document. */}
      {(custom || resetState.ok || resetState.error) && (
        <section className="adm__panel adm__panel--quiet">
          <p className="adm__label" style={{ marginBottom: 6 }}>
            Start again
          </p>
          {custom ? (
            <>
              <p className="adm__note" style={{ margin: "0 0 14px" }}>
                Puts {productName} back to the images the site shipped with. Yours are removed
                from the page; the files themselves are kept.
              </p>
              <form action={resetAction}>
                <input type="hidden" name="slug" value={slug} />
                <button
                  className="adm__btn adm__btn--ghost"
                  type="submit"
                  disabled={resetting}
                  onClick={(e) => {
                    if (!window.confirm(`Put ${productName} back to its original images?`)) {
                      e.preventDefault();
                    }
                  }}
                >
                  {resetting ? "Working…" : "Back to the original images"}
                </button>
              </form>
            </>
          ) : (
            <p className="adm__note" style={{ margin: 0 }}>
              {productName} is showing the images the site shipped with.
            </p>
          )}
          <Result state={resetState} />
        </section>
      )}
    </>
  );
}
