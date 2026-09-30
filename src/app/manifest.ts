import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hot Tacos Portal",
    short_name: "HT Portal",
    description: "Portal interno de coordinación de Hot Tacos",
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

