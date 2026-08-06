import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRuntime } from "./pwa-runtime";
import "./globals.css";
import "./visual-overhaul.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-appearance="black" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceFoucScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PwaRuntime />
        {children}
      </body>
    </html>
  );
}
