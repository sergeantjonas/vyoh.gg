import type { ExternalToast } from "sonner";

let cached: typeof import("sonner") | null = null;

async function load() {
  if (!cached) cached = await import("sonner");
  return cached;
}

export async function toastMessage(message: string, options?: ExternalToast) {
  const sonner = await load();
  sonner.toast(message, options);
}

export async function toastError(message: string, options?: ExternalToast) {
  const sonner = await load();
  sonner.toast.error(message, options);
}

export async function toastSuccess(message: string, options?: ExternalToast) {
  const sonner = await load();
  sonner.toast.success(message, options);
}

export async function toastInfo(message: string, options?: ExternalToast) {
  const sonner = await load();
  sonner.toast.info(message, options);
}
