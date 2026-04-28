import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://nexora.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Nexora Home | Smart IoT Dashboard",
    template: "%s | Nexora Home",
  },
  description:
    "A premium smart home IoT dashboard for managing rooms, devices, automation, security, analytics, alerts, and energy optimization.",
  keywords: [
    "Nexora Home",
    "Smart Home Dashboard",
    "IoT Dashboard",
    "Home Automation",
    "Energy Analytics",
    "Smart Security",
  ],
  authors: [{ name: "AkiliNova Technologies" }],
  creator: "AkiliNova Technologies",
  openGraph: {
    title: "Nexora Home | Smart IoT Dashboard",
    description:
      "Control rooms, devices, automation, security, analytics, and energy usage from one premium smart home dashboard.",
    url: siteUrl,
    siteName: "Nexora Home",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Nexora Home smart IoT dashboard preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexora Home | Smart IoT Dashboard",
    description:
      "A premium smart home IoT dashboard for automation, security, analytics, and energy optimization.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: "/icon",
    apple: "/apple-icon",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full antialiased", inter.variable)}>
      <body className="min-h-full bg-[#0B0F14] font-sans text-[#F9FAFB]">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
