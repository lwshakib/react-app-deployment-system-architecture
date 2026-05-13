import type { Metadata } from "next"
import "@workspace/ui/globals.css"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

export const metadata: Metadata = {
  title: "React Deployment System | Deploy in Seconds",
  description:
    "High-performance deployment infrastructure for React applications, featuring real-time build observability and 16:9 previews.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
