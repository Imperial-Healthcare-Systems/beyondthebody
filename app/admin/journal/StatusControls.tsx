"use client";

/* Publish / unpublish / archive. Separate from the save form so a status change never
   silently carries unsaved edits with it — the client presses "Publish" expecting to
   publish what they last saved, not whatever is currently in the box. */

import { useActionState } from "react";
import { setStatusAction, type JournalFormState } from "./actions";

export default function StatusControls({ id, status }: { id: string; status: string }) {
  const [state, formAction, pending] = useActionState<JournalFormState, FormData>(
    setStatusAction,
    {}
  );

  return (
    <form action={formAction} className="adm__row">
      <input type="hidden" name="id" value={id} />

      {status !== "published" ? (
        <button className="adm__btn" name="status" value="published" type="submit" disabled={pending}>
          {pending ? "Working…" : "Publish"}
        </button>
      ) : (
        <button
          className="adm__btn adm__btn--ghost"
          name="status"
          value="draft"
          type="submit"
          disabled={pending}
        >
          {pending ? "Working…" : "Unpublish"}
        </button>
      )}

      {status !== "archived" && (
        <button
          className="adm__btn adm__btn--ghost"
          name="status"
          value="archived"
          type="submit"
          disabled={pending}
        >
          Archive
        </button>
      )}

      {state.ok && <span role="status" style={{ color: "#4a6b46", fontSize: 13 }}>{state.ok}</span>}
      {state.error && <span role="alert" style={{ color: "#8a4a4a", fontSize: 13 }}>{state.error}</span>}
    </form>
  );
}
