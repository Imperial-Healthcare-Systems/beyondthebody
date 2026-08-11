"use client";

import { useState } from "react";

const ERRORS: Record<string, string> = {
  missing: "That link was incomplete. Request a new one below.",
  invalid: "That link has already been used. Request a new one below.",
  expired: "That link has expired. Request a new one below.",
  disabled: "That account no longer has access.",
};

export default function LoginForm({ error }: { error?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;

    const email = new FormData(e.currentTarget).get("email");
    setState("sending");

    try {
      const res = await fetch("/api/v1/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Request failed");

      /* The response is identical whether or not the address has access — there is
         nothing here to branch on, deliberately. */
      setMessage(data.message);
      setState("sent");
    } catch {
      setMessage("Couldn't send that just now. Please try again in a moment.");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <p className="adm__note" role="status">
        {message} The link works once and expires in 15 minutes.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      {error && ERRORS[error] && (
        <p className="adm__error" role="alert">
          {ERRORS[error]}
        </p>
      )}
      <div className="adm__field">
        <label className="adm__label" htmlFor="email">
          Email
        </label>
        <input
          className="adm__input"
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          disabled={state === "sending"}
        />
      </div>
      <button className="adm__btn" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Send sign-in link"}
      </button>
      {state === "error" && (
        <p className="adm__error" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}
