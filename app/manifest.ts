import type { MetadataRoute } from "next";

/** Lets phones install the site to the home screen so it opens full-screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Care Companion",
    short_name: "Care Companion",
    description: "Speak a child's day, see it as a table, a timeline and aggression insights.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f3ef",
    theme_color: "#256abf",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
