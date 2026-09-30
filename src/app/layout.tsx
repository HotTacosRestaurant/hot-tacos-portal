import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Iniciativas | Hot Tacos Portal",
  description: "Portal interno de coordinación de Hot Tacos",
  applicationName: "Hot Tacos Portal",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HT Portal",
  },
};

export const viewport: Viewport = {
  themeColor: "#211e1a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
