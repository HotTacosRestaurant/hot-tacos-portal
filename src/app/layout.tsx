import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Iniciativas | Portal del Grupo Corporativo",
  description: "Portal interno de coordinación del Grupo Corporativo",
  applicationName: "Portal del Grupo Corporativo",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Grupo Corporativo",
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
