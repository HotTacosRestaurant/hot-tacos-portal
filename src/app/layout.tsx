import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hot-tacos-portal.vercel.app"),

  title: "Business Transformation | Grupo Corporativo",

  description:
    "Portal de iniciativas y coordinación del Grupo Corporativo",

  applicationName: "Business Transformation Portal",

  icons: {
    icon: [
      {
        url: "/bt-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/bt-apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },

  openGraph: {
    title: "Business Transformation | Grupo Corporativo",
    description:
      "Portal de iniciativas y coordinación del Grupo Corporativo",
    url: "/",
    siteName: "Business Transformation Portal",
    type: "website",
    locale: "es_CA",
    images: [
      {
        url: "/bt-whatsapp-preview.png",
        width: 1200,
        height: 630,
        alt: "Business Transformation — Grupo Corporativo",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Business Transformation | Grupo Corporativo",
    description:
      "Portal de iniciativas y coordinación del Grupo Corporativo",
    images: ["/bt-whatsapp-preview.png"],
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BT Portal",
  },
};

export const viewport: Viewport = {
  themeColor: "#211e1a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" translate="no">
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
