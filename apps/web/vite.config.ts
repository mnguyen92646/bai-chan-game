import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  // The general public/ folder includes private questionnaire material.
  // buildPublic.mjs copies only game assets into the release bundle.
  publicDir: false,
  plugins: [
    // Only the play routes belong in the public Worker. Questionnaire routes
    // read local response files and remain on the private Next.js preview.
    vinext({ appDir: "public-app" }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
