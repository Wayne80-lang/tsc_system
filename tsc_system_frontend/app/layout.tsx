import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: '%s | TSC System Access',
    default: 'TSC System Access',
  },
  description: 'The Teachers Service Commission System Access Management Portal',
  icons: {
    icon: '/logo-new.jpeg',
  },
};

import SessionTimeout from '@/components/SessionTimeout';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${outfit.variable} antialiased font-sans`}
      >
        <SessionTimeout />
        {children}
      </body>
    </html>
  );
}
