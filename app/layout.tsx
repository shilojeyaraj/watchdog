import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import { Manrope } from "next/font/google";
import { UserSync } from "@/components/UserSync";
import { Navbar } from "@/components/navbar";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Watchdog",
  description: "Security Analyzer Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${manrope.variable} antialiased`}>
          <UserSync />
          <Navbar />
          <main className="pt-14">
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
