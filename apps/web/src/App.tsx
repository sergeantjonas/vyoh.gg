import { Button } from "@/components/ui/button";
import { type Variants, motion } from "motion/react";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

function App() {
  return (
    <motion.main
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background text-foreground"
      initial="hidden"
      animate="show"
      variants={container}
    >
      <motion.h1 variants={item} className="text-4xl font-bold tracking-tight">
        vyoh.gg
      </motion.h1>
      <motion.p variants={item} className="text-muted-foreground">
        Cross-platform gaming dashboard.
      </motion.p>
      <motion.div variants={item}>
        <Button>Get started</Button>
      </motion.div>
    </motion.main>
  );
}

export default App;
