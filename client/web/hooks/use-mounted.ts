"use client";

import { useEffect, useState } from "react";

/**
 * False during SSR and the hydration render, true afterwards.
 *
 * Use it to gate markup that depends on browser-only state (localStorage-backed
 * stores, media queries) so the first client render still matches the server.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
