import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Management Information | KPIs",
  description: "Vista de indicadores de gestión y seguimiento de iniciativas.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
