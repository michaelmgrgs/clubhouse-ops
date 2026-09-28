"use client";
import { useEffect, useState } from "react";

type T = { id: number; text: string; kind: "ok" | "bad" | "info" };
let push: ((t: Omit<T, "id">) => void) | null = null;

export function toast(text: string, kind: T["kind"] = "info") {
  push?.({ text, kind });
}

export function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    let n = 0;
    push = (t) => {
      const id = ++n;
      setItems((xs) => [...xs, { ...t, id }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.kind === "bad" ? 6000 : 3000);
    };
    return () => {
      push = null;
    };
  }, []);
  return (
    <div style={{ position: "fixed", top: 12, left: 12, right: 12, zIndex: 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none" }}>
      {items.map((t) => (
        <div key={t.id} className={`banner ${t.kind}`} style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxWidth: 520, width: "100%", pointerEvents: "auto" }}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
