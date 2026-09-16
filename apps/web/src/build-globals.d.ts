declare const __BUILD_TIME__: string;
declare const __BUILD_COMMIT__: string;

// Merges into the interface vite/client declares. Without this, the var comes
// back as `any` through that interface's index signature, so a typo in the
// name would silently read `undefined` and fall through to the dev origin.
interface ImportMetaEnv {
  /** Absolute public origin of the api. Set at build time by the deploy; see `src/lib/api-url.ts`. */
  readonly VITE_API_URL?: string;
  /** Browser Sentry DSN. Baked in at build time; absent disables the SDK. See `src/instrument.ts`. */
  readonly VITE_SENTRY_DSN?: string;
  /** Browser Sentry sample rate, `0`–`1`. Absent means 1. See `src/instrument.ts`. */
  readonly VITE_SENTRY_SAMPLE_RATE?: string;
}
