import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Nexora Home",
    template: "%s | Nexora Home",
  },
  description:
    "A scalable Smart IoT Home Management Dashboard simulating real-time device communication, automation logic, and energy analytics.",
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
