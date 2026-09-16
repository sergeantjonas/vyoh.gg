import { bufferEarlyErrors } from "./early-errors";

/**
 * Installs the early-error listeners as a module side effect.
 *
 * Separate from `early-errors.ts` because *when* this runs is the whole point.
 * ES imports are evaluated before the importing module's body, so calling
 * `bufferEarlyErrors` from `client.tsx`'s body would install the listeners only
 * after react-dom and the Start client had already been evaluated — leaving the
 * exact module-evaluation throw this exists to catch unreported.
 *
 * Importing this first in `client.tsx` makes the listeners the first thing that
 * happens in the bundle. **That import's position is load-bearing**, not
 * stylistic: anything sorted above it is code the buffer cannot see.
 */
export const earlyErrors = bufferEarlyErrors(window);
