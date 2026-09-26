import { useEffect, type ReactElement } from "react";
import { handleCallback } from "../authz/session";

// The one registered redirect URI serves both the redirect leg and the silent
// renew's hidden iframe; handleCallback() (signinCallback()) dispatches on
// request_type and returns nothing — this page renders from the promise
// SETTLING, not from a value, and then sends the browser home.
export function CallbackPage(): ReactElement {
  useEffect(() => {
    void handleCallback().finally(() => {
      window.location.assign("/");
    });
  }, []);

  return (
    <main>
      <p>Signing you in…</p>
    </main>
  );
}
