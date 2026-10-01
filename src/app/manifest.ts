import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Business Transformation Portal",
    short_name: "BT Portal",
    description:
      "Portal de iniciativas y coordinación del Grupo Corporativo",
    start_url: "/",
    display: "standalone",
    background_color: "#0D1B29",
    theme_color: "#14283B",
    lang: "es",
    icons: [
      {
        src: "/bt-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/bt-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/bt-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}