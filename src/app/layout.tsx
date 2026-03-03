import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GHL Field Usage Dashboard",
  description: "Audit and clean GoHighLevel custom fields across your contacts."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
