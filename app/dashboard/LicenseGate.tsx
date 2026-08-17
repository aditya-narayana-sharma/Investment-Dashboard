"use client";

import { Lock } from "lucide-react";
import {
  LICENSE_TIERS,
  TIER_INCLUDES,
  TIER_LABELS,
  upgradeTarget,
  type LicenseFeature,
  type PublicLicense,
} from "../license";

export function LicenseGate({
  feature,
  license,
  title,
}: {
  feature: LicenseFeature;
  license: PublicLicense;
  title: string;
}) {
  const required = upgradeTarget(feature);
  return (
    <section className="license-gate" data-license-gate={feature} role="region" aria-label={`${title} requires ${TIER_LABELS[required]}`}>
      <Lock size={28} aria-hidden="true" />
      <h2>{title} is a {TIER_LABELS[required]} feature</h2>
      <p>
        This Mac is on <b>{TIER_LABELS[license.tier]}</b>. Stratji does not invent live data behind a paywall.
        Unlock {TIER_LABELS[required]} with a license key in Settings. Downstream clones stay Basic until a paid key is pasted.
      </p>
      <div className="license-gate-columns">
        {LICENSE_TIERS.map((tier) => (
          <article key={tier} data-active={tier === required ? "1" : undefined}>
            <h3>{TIER_LABELS[tier]}</h3>
            <ul>
              {TIER_INCLUDES[tier].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <p className="license-gate-hint">
        Paste a key such as <code>stratji-{required}-yourtoken</code> in Settings, or set{" "}
        <code>STRATJI_LICENSE_KEY</code>. v1 is an honor + key file on this Mac — not a billing server. The author Mac uses a local master key.
      </p>
    </section>
  );
}
