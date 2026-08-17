"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  coercePublicLicense,
  defaultPublicLicense,
  mergeFetchedLicense,
  type PublicLicense,
} from "./license";

type LicenseSnapshotContextValue = {
  license: PublicLicense;
  setLicense: (next: PublicLicense) => void;
};

const LicenseSnapshotContext = createContext<LicenseSnapshotContextValue | null>(null);

export function LicenseSnapshotProvider({
  initialLicense,
  children,
}: {
  initialLicense: PublicLicense;
  children: ReactNode;
}) {
  const [license, setLicenseState] = useState<PublicLicense>(() => coercePublicLicense(initialLicense) ?? defaultPublicLicense());
  const setLicense = useCallback((next: PublicLicense) => {
    setLicenseState((current) => {
      const fetched = coercePublicLicense(next);
      return mergeFetchedLicense(current, fetched);
    });
  }, []);
  const value = useMemo(() => ({ license, setLicense }), [license, setLicense]);
  return <LicenseSnapshotContext.Provider value={value}>{children}</LicenseSnapshotContext.Provider>;
}

export function useLicenseSnapshot(): LicenseSnapshotContextValue {
  const value = useContext(LicenseSnapshotContext);
  if (value) return value;
  return {
    license: defaultPublicLicense(),
    setLicense: () => undefined,
  };
}
