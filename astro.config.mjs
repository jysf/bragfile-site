// @ts-check
import { defineConfig, fontProviders } from "astro/config";

export default defineConfig({
  site: "https://bragfile.jysf.org",
  output: "static",

  // Astro's built-in Fonts API: downloads, subsets, self-hosts and generates
  // fallbacks. No third-party font request at runtime, which matters on a page
  // arguing that your data never leaves your machine.
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Archivo",
      cssVariable: "--font-sans",
      weights: [400, 600],
      styles: ["normal"],
    },
    {
      provider: fontProviders.google(),
      name: "JetBrains Mono",
      cssVariable: "--font-mono",
      weights: [400],
      styles: ["normal"],
    },
  ],
});
