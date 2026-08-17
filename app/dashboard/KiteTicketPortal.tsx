"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Mount tickets on document.body so exclusive workspace panes cannot clip or intercept them. */
export function KiteTicketPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return children;
  return createPortal(children, document.body);
}
