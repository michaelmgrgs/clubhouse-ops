"use client";
import { Icon } from "./Icon";

export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  return (
    <button className="btn no-print" onClick={() => window.print()}>
      <Icon name="file" size={16} /> {label}
    </button>
  );
}
