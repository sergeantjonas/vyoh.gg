import { readFileSync } from "node:fs";
import { join } from "node:path";

const fontsDir = join(__dirname, "fonts");

export const fonts = [
  {
    name: "Geist",
    data: readFileSync(join(fontsDir, "Geist-Regular.ttf")),
    weight: 400,
    style: "normal",
  },
  {
    name: "Geist",
    data: readFileSync(join(fontsDir, "Geist-SemiBold.ttf")),
    weight: 600,
    style: "normal",
  },
] as const;
