import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "জন্ম নিবন্ধন যাচাই | Birth Certificate Verification",
  description:
    "Bangladesh birth registration verification via official BDRIS (everify.bdris.gov.bd) and optional Porichoy integration.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bn">
      <body>{children}</body>
    </html>
  );
}
