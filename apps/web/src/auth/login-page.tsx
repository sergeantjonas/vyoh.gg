import { LoginButton } from "./login-button";
import type { LoginError } from "./login-search";
import { LogoutButton } from "./logout-button";
import { useViewer } from "./use-viewer";

// Copy for the three ways `GET /auth/github/callback` can bounce someone back
// here. Deliberately vague about `forbidden` — telling a stranger that their
// GitHub account was recognised but rejected confirms the flow works and that
// they are simply the wrong person, which is more than they need to know.
const ERROR_COPY: Record<LoginError, string> = {
  state: "That login link expired or didn't match. Start again from here.",
  github: "GitHub didn't complete the handshake. Try once more.",
  forbidden: "That account can't sign in here.",
};

export function LoginPage({ error, next }: { error?: LoginError; next?: string }) {
  const { data: viewer } = useViewer();

  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 px-6 py-24">
      <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>

      {viewer?.isOwner === true ? (
        <>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="text-foreground">@{viewer.login}</span>. The
            admin controls on the status page are unlocked.
          </p>
          <LogoutButton className="-ml-2" />
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            vyoh.gg is public to read. Signing in only unlocks the owner's admin controls
            — syncing and pausing the upstream pollers.
          </p>
          {error !== undefined && (
            // `role="alert"` rather than a plain paragraph: the callback lands
            // here as a fresh page load, so nothing else announces why the
            // previous attempt didn't take.
            <p role="alert" className="text-sm text-destructive">
              {ERROR_COPY[error]}
            </p>
          )}
          <LoginButton {...(next === undefined ? {} : { next })} />
        </>
      )}
    </div>
  );
}
