import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined") {
        return () => {};
      }

      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", onStoreChange);
      return () => mediaQueryList.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = () => typeof window !== "undefined" && window.matchMedia(query).matches;

  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const BELOW_MD_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
  return useMediaQuery(BELOW_MD_QUERY);
}

const ABOVE_LG_QUERY = "(min-width: 1024px)";
export function useIsLgAndAbove(): boolean {
  return useMediaQuery(ABOVE_LG_QUERY);
}
