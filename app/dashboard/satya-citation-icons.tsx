"use client";

import type { ReactNode } from "react";
import { FileText, LineChart, Mail, Mic2 } from "lucide-react";
import {
  citationSourceBadges,
  type SatyaCitation,
  type SatyaCitationKind,
} from "./satya-client";

function citationIcon(kind: SatyaCitationKind): ReactNode {
  switch (kind) {
    case "mail":
      return <Mail size={15} />;
    case "pdf":
      return <FileText size={15} />;
    case "podcast":
      return <Mic2 size={15} />;
    case "earnings":
      return <LineChart size={15} />;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Category badges with counts on the drafting strip. Compact: one control per kind, not per document. */
export function SatyaCitationIcons({ citations }: { citations: SatyaCitation[] }) {
  const badges = citationSourceBadges(citations);
  if (!badges.length) return null;
  return (
    <div className="satya-citation-icons" role="group" aria-label="Cited source counts">
      {badges.map((badge) => {
        const title = badge.titles.join("\n");
        const aria = `${badge.label}, ${badge.count}`;
        const href = badge.hrefs[0];
        const inner = (
          <>
            {citationIcon(badge.kind)}
            <span className="satya-citation-badge-label">{badge.label}</span>
            <span className="satya-citation-badge-count">{badge.count}</span>
          </>
        );
        if (!href) {
          return (
            <span
              key={badge.kind}
              className="satya-citation-badge satya-citation-icon"
              data-kind={badge.kind}
              data-count={badge.count}
              title={title}
              aria-label={aria}
            >
              {inner}
            </span>
          );
        }
        return (
          <a
            key={badge.kind}
            className="satya-citation-badge satya-citation-icon"
            data-kind={badge.kind}
            data-count={badge.count}
            href={href}
            target={href.startsWith("http") || href.startsWith("/") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            aria-label={aria}
            title={title}
          >
            {inner}
          </a>
        );
      })}
    </div>
  );
}
