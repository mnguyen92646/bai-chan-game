import { build } from "esbuild";
import { writeFile } from "node:fs/promises";

const applicationID = process.env.NEXT_PUBLIC_NR_APPLICATION_ID;
const licenseKey = process.env.NEXT_PUBLIC_NR_BROWSER_KEY;
const accountID = process.env.NEXT_PUBLIC_NR_ACCOUNT_ID;
const outfile = new URL("../dist/client/monitor.js", import.meta.url).pathname;
if (!applicationID && !licenseKey && !accountID) {
  await writeFile(outfile, "// Browser monitoring is not configured for this build.\n");
  process.exit(0);
}
if (!applicationID || !licenseKey || !accountID) throw new Error("Set all New Relic browser config values or omit all three.");

await build({
  entryPoints: [new URL("browserMonitoring.ts", import.meta.url).pathname],
  outfile,
  bundle: true,
  minify: true,
  platform: "browser",
  format: "iife",
  target: "es2020",
  define: {
    "process.env.NEXT_PUBLIC_NR_APPLICATION_ID": JSON.stringify(applicationID),
    "process.env.NEXT_PUBLIC_NR_BROWSER_KEY": JSON.stringify(licenseKey),
    "process.env.NEXT_PUBLIC_NR_ACCOUNT_ID": JSON.stringify(accountID),
  },
});
