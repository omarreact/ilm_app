import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "বাংলাদেশ পরিচয় যাচাই | NID & Birth Verification",
  description: "Authorized Bangladesh NID and birth registration verification using Porichoy, with official BDRIS and NID portal fallbacks.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bn">
      <body>{children}</body>
    </html>
  );
}
