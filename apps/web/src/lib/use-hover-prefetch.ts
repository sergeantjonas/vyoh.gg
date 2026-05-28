import { useCallback, useEffect, useRef } from "react";

const noop = () => {};

type SaveDataNavigator = Navigator & {
  connection?: { saveData?: boolean };
};

function isSaveDataEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as SaveDataNavigator).connection?.saveData === true;
}

export function useHoverPrefetch(
  trigger: () => void,
  { delay = 150 }: { delay?: number } = {}
) {
  const timer = useRef<number | null>(null);
  const triggerRef = useRef(trigger);
  triggerRef.current = trigger;

  const onPointerEnter = useCallback(() => {
    timer.current = window.setTimeout(() => {
      timer.current = null;
      triggerRef.current();
    }, delay);
  }, [delay]);

  const onPointerLeave = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onPointerDown = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    triggerRef.current();
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  if (isSaveDataEnabled()) {
    return { onPointerEnter: noop, onPointerLeave: noop, onPointerDown: noop };
  }

  return { onPointerEnter, onPointerLeave, onPointerDown };
}
