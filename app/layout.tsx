import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRuntime } from "./pwa-runtime";
import { readDashboardLicense } from "./license-server";
import { LicenseSnapshotProvider } from "./license-snapshot";
import "./globals.css";
import "./visual-overhaul.css";

export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portfolio Intelligence",
  description: "Private live portfolio, research, earnings and wellness dashboard.",
  applicationName: "Portfolio Intelligence",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Portfolio",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: "#050607",
};

const appearanceFoucScript = `(function(){try{var a=localStorage.getItem("dashboard-appearance");if(a==="dark"||a==="sepia"||a==="black")document.documentElement.dataset.appearance=a;else document.documentElement.dataset.appearance="black";}catch(e){document.documentElement.dataset.appearance="black";}})();`;
const nativeChromeFoucScript = `(function(){try{var q=location.search||"";var native=/(?:^|[?&])(?:nativeChrome|native)=(1|true)(?:&|$)/.test(q)||/\\bStratji\\//i.test(navigator.userAgent||"");if(native){document.documentElement.classList.add("native-chrome-embed");document.documentElement.dataset.nativeChrome="1";}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const license = await readDashboardLicense();
  const licenseTierScript = `document.documentElement.dataset.licenseTier=${JSON.stringify(license.tier)};document.documentElement.dataset.licenseSource=${JSON.stringify(license.source)};`;
  return (
    <html lang="en" data-appearance="black" data-license-tier={license.tier} data-license-source={license.source} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceFoucScript }} />
        <script dangerouslySetInnerHTML={{ __html: nativeChromeFoucScript }} />
        <script dangerouslySetInnerHTML={{ __html: licenseTierScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PwaRuntime />
        <LicenseSnapshotProvider initialLicense={license}>
          {children}
        </LicenseSnapshotProvider>
      </body>
    </html>
  );
}
