import { OrbGlyph } from "@/components/orb-glyph";
import { Button } from "@/components/ui/button";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error) => ReactNode);
  onError?: ((error: Error, info: ErrorInfo) => void) | undefined;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info);
    this.props.onError?.(error, info);
  }

  override render(): ReactNode {
    if (this.state.error) {
      const { fallback } = this.props;
      if (typeof fallback === "function") return fallback(this.state.error);
      if (fallback !== undefined) return fallback;
      return null;
    }
    return this.props.children;
  }
}

/**
 * Full-card crash fallback shared by the app-root tier (main.tsx, outside the
 * router) and the page-content tier (__root's <Outlet> boundary). `fullScreen`
 * centres it in the viewport for the root tier; the page tier renders it inside
 * the constrained <main> column. `error.message` shows only when an error is
 * threaded through — the static root fallback omits it.
 */
export function AppErrorFallback({
  error,
  title = "Something went wrong.",
  fullScreen = false,
}: {
  error?: Error;
  title?: string;
  fullScreen?: boolean;
}) {
  const card = (
    <div className="flex flex-col items-center gap-4 rounded-md border border-destructive/30 bg-destructive/10 px-6 py-10 text-center">
      <OrbGlyph className="size-16" />
      <p className="text-sm font-medium text-destructive">{title}</p>
      {error?.message && (
        <p className="font-mono text-xs text-muted-foreground">{error.message}</p>
      )}
      <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
        Reload
      </Button>
    </div>
  );

  if (!fullScreen) return card;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
      {card}
    </div>
  );
}

/**
 * Quiet, compact fallback for the widget tier — a single fragile leaf (a chart,
 * the splash backdrop) fails into a small "unavailable" frame instead of taking
 * its whole route-content region down with it.
 */
export function WidgetErrorFallback({ message }: { message?: string | undefined }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-border/60 bg-card/40 px-4 py-6 text-center">
      <p className="text-xs text-muted-foreground">
        {message ?? "This section is unavailable."}
      </p>
    </div>
  );
}

/**
 * Widget-tier boundary: wraps a fragile leaf so it "fails small". Defaults to
 * the compact WidgetErrorFallback; pass `fallback={null}` for decorative leaves
 * that should fail silently (splash backdrop, command-palette overlay).
 */
export function WidgetBoundary({
  children,
  message,
  fallback,
  onError,
}: {
  children: ReactNode;
  message?: string;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}) {
  return (
    <ErrorBoundary
      onError={onError}
      fallback={
        fallback !== undefined ? fallback : <WidgetErrorFallback message={message} />
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Widget-tier preset for chart leaves (Recharts / visx). A single chart
 * crashing on degenerate data fails into a compact "chart unavailable" frame
 * instead of taking its sibling charts or the rest of the route-content region
 * down with it. Applied at chart call sites so it also catches the component's
 * own data-prep, not just its render subtree.
 */
export function ChartBoundary({ children }: { children: ReactNode }) {
  return <WidgetBoundary message="This chart is unavailable.">{children}</WidgetBoundary>;
}
