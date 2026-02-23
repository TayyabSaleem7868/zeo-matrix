import * as React from "react";

type LowEndDeviceState = {
  isLowEnd: boolean;
};

function estimateLowEndDevice(): boolean {
  if (typeof window === "undefined") return false;

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
    connection?: { effectiveType?: string; saveData?: boolean };
  };

  const prefersReducedMotion =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const deviceMemory = nav.deviceMemory;
  const cores = nav.hardwareConcurrency;
  const saveData = nav.connection?.saveData;
  const effectiveType = nav.connection?.effectiveType;

  const lowMemory = typeof deviceMemory === "number" && deviceMemory > 0 && deviceMemory <= 4;
  const lowCores = typeof cores === "number" && cores > 0 && cores <= 4;
  const slowNetwork = effectiveType === "2g" || effectiveType === "slow-2g";

  return Boolean(prefersReducedMotion || saveData || slowNetwork || lowMemory || lowCores);
}

export function useLowEndDevice(): LowEndDeviceState {
  const [isLowEnd, setIsLowEnd] = React.useState(false);

  React.useEffect(() => {
    const update = () => setIsLowEnd(estimateLowEndDevice());

    update();

    const nav = navigator as Navigator & {
      connection?: { addEventListener?: (type: string, cb: () => void) => void; removeEventListener?: (type: string, cb: () => void) => void };
    };

    const onChange = () => update();

    window.addEventListener("resize", onChange);
    nav.connection?.addEventListener?.("change", onChange);

    return () => {
      window.removeEventListener("resize", onChange);
      nav.connection?.removeEventListener?.("change", onChange);
    };
  }, []);

  return { isLowEnd };
}
