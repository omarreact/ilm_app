import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Seba Public Intelligence Monitor",
  description: "Passive public-source monitoring of Bangladesh digital service portals"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
