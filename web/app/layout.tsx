import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";


export const metadata: Metadata = {
  title: "React Deployment System | Deploy in Seconds",
  description: "High-performance deployment infrastructure for React applications, featuring real-time build observability and 16:9 previews.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">
         <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
