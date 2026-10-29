"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { clearToken, getToken, setToken, verifyToken } from "../lib/api";

type State = "checking" | "signedOut" | "signedIn";

/**
 * Shows the dashboard only after the admin token (the dashboard API's PULSE_ADMIN_TOKEN) was accepted.
 * Any 401 from the API (see lib/api.ts) brings the sign-in form back.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("checking");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const saved = getToken();
    if (!saved) {
      setState("signedOut");
    } else {
      verifyToken(saved)
        .then((ok) => {
          if (cancelled) return;
          if (!ok) clearToken();
          setState(ok ? "signedIn" : "signedOut");
        })
        // API unreachable: keep the token and show the dashboard, which reports the connection problem itself.
        .catch(() => !cancelled && setState("signedIn"));
    }

    const onUnauthorized = () => {
      setError("Your session is no longer valid. Sign in again.");
      setState("signedOut");
    };
    window.addEventListener("pulse:unauthorized", onUnauthorized);

    return () => {
      cancelled = true;
      window.removeEventListener("pulse:unauthorized", onUnauthorized);
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const token = value.trim();
    if (!token) return;

    setBusy(true);
    setError("");
    try {
      if (await verifyToken(token)) {
        setToken(token);
        setValue("");
        setState("signedIn");
      } else {
        setError("That token was not accepted.");
      }
    } catch {
      setError("Can't reach the dashboard API. Is pulse-dashboard running?");
    } finally {
      setBusy(false);
    }
  }

  if (state === "signedIn") return <>{children}</>;

  if (state === "checking") {
    return <div className="flex h-screen w-full items-center justify-center text-sm text-muted">Loading…</div>;
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-bg px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-border bg-panel p-6 shadow-2xl">
        <h1 className="text-lg font-semibold">Pulse</h1>
        <p className="mt-1 text-xs text-muted">
          Enter the admin token of your dashboard API (<code>PULSE_ADMIN_TOKEN</code>).
        </p>

        <input
          type="password"
          autoFocus
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Admin token"
          className="mt-4 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />

        {error && <p className="mt-2 text-xs text-bad">{error}</p>}

        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="mt-4 w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
