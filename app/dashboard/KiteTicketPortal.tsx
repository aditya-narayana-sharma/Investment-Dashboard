"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Render Kite tickets on `document.body` so exclusive I-2 overflow cannot clip them. */
export function KiteTicketPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
