import { Button } from "@/components/ui/button";

function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-4xl font-bold tracking-tight">vyoh.gg</h1>
      <p className="text-muted-foreground">Cross-platform gaming dashboard.</p>
      <Button>Get started</Button>
    </main>
  );
}

export default App;
