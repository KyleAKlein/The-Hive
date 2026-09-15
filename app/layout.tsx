import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Hive | Lightning in motion",
  description: "Find people, send Lightning tips, and collect the moments that move through The Hive.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
