import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Hero3DCanvas from "@/components/canvas/Hero3DCanvas";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lomely — Synchronized Media, Voice & Room Collaboration",
  description:
    "A clean, claymorphic space to stream music, watch videos together in sync, and hop into voice & video calls.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased selection:bg-brand-500 selection:text-black`}>
        <AuthProvider>
          <Hero3DCanvas />
          <div className="relative z-10 flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1 flex flex-col">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
