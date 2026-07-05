import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACV OS | AnonenCardVault",
  description: "Command-center shell for AnonenCardVault operations."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
