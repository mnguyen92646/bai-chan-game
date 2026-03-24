/* OpenTelemetry bootstrap for BaiChanGame (Node/Express)
 *
 * Loaded via Node's --require (CommonJS) so it works even though the app is ESM ("type": "module").
 * Export is configured purely via OTEL_* env vars.
 */

'use strict';

// Load local env vars when running under pm2/npm (they don't auto-load .env).
// .env is gitignored by the repo's top-level .gitignore.
require('dotenv').config();

const process = require('process');

// Enable OpenTelemetry SDK diagnostics (helps confirm exporter URLs, errors, etc.)
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
const level = (process.env.OTEL_LOG_LEVEL || 'info').toLowerCase();
const map = { none: DiagLogLevel.NONE, error: DiagLogLevel.ERROR, warn: DiagLogLevel.WARN, info: DiagLogLevel.INFO, debug: DiagLogLevel.DEBUG, verbose: DiagLogLevel.VERBOSE };
diag.setLogger(new DiagConsoleLogger(), map[level] ?? DiagLogLevel.INFO);

diag.info('[otel] bootstrap loaded', {
  service: process.env.OTEL_SERVICE_NAME,
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  tracesEndpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
  metricsEndpoint: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
  protocol: process.env.OTEL_EXPORTER_OTLP_PROTOCOL,
  tracesExporter: process.env.OTEL_TRACES_EXPORTER,
  metricsExporter: process.env.OTEL_METRICS_EXPORTER,
});

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} = require('@opentelemetry/semantic-conventions');

const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');

const serviceName = process.env.OTEL_SERVICE_NAME || 'BaiChanGame';
const serviceVersion = process.env.npm_package_version || process.env.SERVICE_VERSION;
const deploymentEnv = process.env.NODE_ENV || 'development';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
    ...(serviceVersion ? { [SEMRESATTRS_SERVICE_VERSION]: serviceVersion } : {}),
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: deploymentEnv,
  }),
  // Exporters read endpoint/headers/protocol/etc from OTEL_* env vars.
  traceExporter: new OTLPTraceExporter(),
  // In OTel JS SDK, metrics export is configured via MetricReader(s).
  metricReaders: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      // 10s is a decent dev default; tune later.
      exportIntervalMillis: 10_000,
    }),
  ],
  instrumentations: [
    getNodeAutoInstrumentations({
      // Make server-span names descriptive (METHOD + matched route template) like traditional APM.
      // Express attaches route info to the request object; we use it at response-finish time.
      '@opentelemetry/instrumentation-http': {
        applyCustomAttributesOnSpan: (span, request, _response) => {
          try {
            if (!request || typeof request !== 'object') return;
            const req = request;
            const method = req.method || 'GET';
            // Express request fields (best-effort)
            const baseUrl = req.baseUrl || '';
            const routePath = req.route && req.route.path ? req.route.path : '';
            if (routePath) {
              span.updateName(`${method} ${baseUrl}${routePath}`);
              span.setAttribute('http.route', `${baseUrl}${routePath}`);
              return;
            }
          } catch {
            // ignore
          }
        },
      },
      '@opentelemetry/instrumentation-express': {
        // leave default; it will still create middleware/handler spans.
      },
    }),
  ],
});

try {
  // In some SDK versions this is synchronous (returns void), in others it may be async.
  const maybePromise = sdk.start();
  if (maybePromise && typeof maybePromise.then === 'function') {
    maybePromise.catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[otel] failed to start', err);
    });
  }
} catch (err) {
  // Don't crash the server if telemetry init fails; just log.
  // eslint-disable-next-line no-console
  console.error('[otel] failed to start', err);
}

process.on('SIGTERM', async () => {
  try {
    await sdk.shutdown();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[otel] shutdown error', e);
  } finally {
    process.exit(0);
  }
});
