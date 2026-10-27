import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Assistenz-Planer",
    template: "%s · Assistenz-Planer",
  },
  description: "Dienstplanung für persönliche Assistenz im Arbeitgebermodell",
  applicationName: "Assistenz-Planer",
  appleWebApp: {
    capable: true,
    title: "Assistenz",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale: people must be able to zoom.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f5f73" },
    { media: "(prefers-color-scheme: dark)", color: "#0e161c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <a
          href="#inhalt"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-3 focus:text-brand-foreground"
        >
          Zum Inhalt springen
        </a>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
