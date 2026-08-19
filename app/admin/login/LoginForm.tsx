"use client";

/* Two ways in, one form (password added 2026-08-19, client request):
 *   - password: for accounts that have one set (scripts/set-admin-password.mjs);
 *     the DEFAULT tab, because it needs no working mailbox.
 *   - link: the original magic-link flow, unchanged.
 * The password submit navigates to /admin itself — the endpoint sets the cookie. */

import { useState } from "react";

const ERRORS: Record<string, string> = {
  missing: "That link was incomplete. Request a new one below.",
  invalid: "That link has already been used. Request a new one below.",
  expired: "That link has expired. Request a new one below.",
  disabled: "That account no longer has access.",
};

export default function LoginForm({ error }: { error?: string }) {
  const [mode, setMode] = useState<"password" | "link">("password");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmitPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;

    const form = new FormData(e.currentTarget);
    setState("sending");

    try {
      const res = await fetch("/api/v1/admin/login/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage(data?.message ?? data?.error?.message ?? "Sign-in failed. Try again.");
        setState("error");
        return;
      }
      /* Cookie is already set — a full navigation lets the server render /admin signed in. */
      window.location.assign("/admin");
    } catch {
      setMessage("Couldn't sign in just now. Please try again in a moment.");
      setState("error");
    }
  }

  async function onSubmitLink(e: React.FormEvent<HTMLFormElement>) {
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

  const switchMode = (next: "password" | "link") => {
    setMode(next);
    setState("idle");
    setMessage("");
  };

  return (
    <div>
      {error && ERRORS[error] && (
        <p className="adm__error" role="alert">
          {ERRORS[error]}
        </p>
      )}

      {mode === "password" ? (
        <form onSubmit={onSubmitPassword}>
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
              autoComplete="username"
              autoFocus
              disabled={state === "sending"}
            />
          </div>
          <div className="adm__field">
            <label className="adm__label" htmlFor="password">
              Password
            </label>
            <input
              className="adm__input"
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              disabled={state === "sending"}
            />
          </div>
          <button className="adm__btn" type="submit" disabled={state === "sending"}>
            {state === "sending" ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : (
        <form onSubmit={onSubmitLink}>
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
        </form>
      )}

      {state === "error" && (
        <p className="adm__error" role="alert">
          {message}
        </p>
      )}

      <p className="adm__note" style={{ marginTop: 16 }}>
        {mode === "password" ? (
          <button className="adm__link" type="button" onClick={() => switchMode("link")}>
            Email me a sign-in link instead
          </button>
        ) : (
          <button className="adm__link" type="button" onClick={() => switchMode("password")}>
            Sign in with a password instead
          </button>
        )}
      </p>
    </div>
  );
}
