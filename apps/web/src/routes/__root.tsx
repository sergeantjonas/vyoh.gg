import { Nav } from "@/components/nav";
import { Outlet, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-dvh bg-background text-foreground">
      <Nav />
      <main className="mx-auto max-w-4xl p-6">
        <Outlet />
      </main>
    </div>
  ),
});
