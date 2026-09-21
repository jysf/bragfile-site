// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import buildStamp from "./scripts/build-stamp.mjs";

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

      // Astro's default fallback chain for a family ends in Arial /
      // sans-serif. On a monospace family that is a rendering bug: the
      // Google subset is `latin`, which stops at U+024F, so every block
      // element in `brag spark` output (U+2580-259F) missed the font and
      // fell to a PROPORTIONAL face. Measured in page at 15px: `M` and
      // most blocks 9.0px, but `▄` and `█` 14.3px — the two tallest bars
      // in every sparkline rendered 59% wide and the charts came out
      // ragged. A monospace fallback chain fixes the whole range at once,
      // and keeps the metric-optimized fallback based on a mono face.
      fallbacks: [
        "ui-monospace",
        "SFMono-Regular",
        "Menlo",
        "Consolas",
        "DejaVu Sans Mono",
        "monospace",
      ],
    },
  ],

  vite: {
    plugins: [buildStamp()],
  },
});