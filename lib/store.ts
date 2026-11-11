"use client";
import { useCallback, useEffect, useState } from "react";
import type { Data } from "./types.ts";

const KEY = "ai-companion-v1";
const EMPTY: Data = { children: [], entries: [] };

export function useData() {
  const [data, setData] = useState<Data>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setData(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  const update = useCallback((fn: (d: Data) => Data) => {
    setData((prev) => {
      const next = fn(prev);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return { data, update, ready };
}

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export function download(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
