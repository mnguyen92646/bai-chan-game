import { Agent } from "@newrelic/browser-agent/loaders/agent";
import { Ajax } from "@newrelic/browser-agent/features/ajax";
import { GenericEvents } from "@newrelic/browser-agent/features/generic_events";
import { JSErrors } from "@newrelic/browser-agent/features/jserrors";
import { Metrics } from "@newrelic/browser-agent/features/metrics";
import { PageViewEvent } from "@newrelic/browser-agent/features/page_view_event";
import { PageViewTiming } from "@newrelic/browser-agent/features/page_view_timing";

const applicationID = process.env.NEXT_PUBLIC_NR_APPLICATION_ID;
const licenseKey = process.env.NEXT_PUBLIC_NR_BROWSER_KEY;
const accountID = Number(process.env.NEXT_PUBLIC_NR_ACCOUNT_ID);

if (applicationID && licenseKey && Number.isSafeInteger(accountID) && document.documentElement.dataset.monitorStatus !== "active") {
  document.documentElement.dataset.monitorStatus = "loading";
  try {
    window.newrelic = new Agent({
      info: {
        applicationID,
        beacon: "bam.nr-data.net",
        errorBeacon: "bam.nr-data.net",
        licenseKey,
        sa: 1,
      },
      loader_config: {
        accountID,
        agentID: Number(applicationID),
        applicationID: Number(applicationID),
        licenseKey,
        trustKey: accountID,
      },
      init: {
        ajax: { deny_list: ["bam.nr-data.net"] },
        // Room IDs are invite credentials; query strings can contain nicknames.
        obfuscate: [
          { regex: /room_[A-Za-z0-9_-]{22}/g, replacement: "PRIVATE_ROOM" },
          { regex: /\?[^#\s]*/g, replacement: "?PRIVATE_QUERY" },
        ],
        page_action: { enabled: true },
        privacy: { cookies_enabled: false },
        user_actions: { enabled: false },
        performance: { capture_marks: false, capture_measures: false, resources: { enabled: false } },
      },
      features: [Ajax, GenericEvents, JSErrors, Metrics, PageViewEvent, PageViewTiming],
    });
    document.documentElement.dataset.monitorStatus = "active";
  } catch (error) {
    document.documentElement.dataset.monitorStatus = "failed";
    console.warn("Browser monitoring failed to start", error instanceof Error ? error.name : "unknown");
  }
}
