import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Portal del Grupo Corporativo",
    short_name: "GC Portal",
    description: "Portal interno de coordinación del Grupo Corporativo",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#211e1a",
    lang: "es",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}

