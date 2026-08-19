"use client";

/* The button that actually unsubscribes.
 *
 * A click, not a page load. Mail clients and corporate security scanners fetch every URL
 * in a message to check it is safe — so an unsubscribe that acted on GET would quietly
 * remove people who never clicked anything. */

import { useState } from "react";

type State = "idle" | "sending" | "done" | "error";

export default function UnsubscribeForm({ token }: { token: string }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  async function onUnsubscribe() {
    setState("sending");
    try {
      const res = await fetch("/api/v1/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error?.message ?? "Request failed");

      setMessage(data.message ?? "You've been removed from the list.");
      setState("done");
    } catch {
      setState("error");
      setMessage("We couldn't complete that just now. Please try again in a moment.");
    }
  }

  if (state === "done") {
    return (
      <>
        <p className="nlp__body" role="status">
          {message}
        </p>
        <div className="nlp__actions">
          <a className="nlp__link" href="/">
            Return to the house
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      {state === "error" && (
        <p className="nlp__body" role="alert">
          {message}
        </p>
      )}
      <div className="nlp__actions">
        <button
          className="nlp__btn"
          type="button"
          onClick={onUnsubscribe}
          disabled={state === "sending"}
        >
          {state === "sending" ? "One moment…" : "Unsubscribe"}
        </button>
        <a className="nlp__link" href="/">
          Stay on the list
        </a>
      </div>
    </>
  );
}
