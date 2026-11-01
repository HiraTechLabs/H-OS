# Logging and Observability Principles (LOG)

### LOG-001 [must|lint] logging
Structured JSON logs only, through the shared logger (pino). Required fields: timestamp, level, service, module, traceId, spanId, organizationId, userId (ID only), event.

### LOG-002 [must|review] logging
Levels: `error` means a human must act, `warn` means degraded but self-recovering, `info` means a business-significant lifecycle event, `debug` is off in production.

### LOG-003 [must|test] logging, config
Never log secrets, tokens, passwords, or personal and payroll data. Redaction is configured in the logger and covered by a test.

### LOG-004 [must|test] logging, events, jobs
Every request, job and event carries a trace ID that propagates across modules, outbox events and background jobs.

### LOG-005 [must|review] logging
Log once, at the boundary that handles the error. Do not log and rethrow.

### LOG-006 [must|test] audit
The business audit trail (SEC-007) is stored in the database and is separate from operational logs. Operational logs are never used as audit evidence.

### LOG-007 [must|ci] logging, infra
Traces and metrics use OpenTelemetry. Every use case creates a span. Key business and system metrics are exposed (for example payroll run duration, outbox lag, job failures).

### LOG-008 [must|test] infra
Liveness and readiness endpoints exist; readiness reflects database and critical dependency health.

### LOG-009 [should|lint] logging
Log messages are constant strings with structured fields. No string concatenation of data into messages.

### LOG-010 [should|review] logging, infra
Retention and rotation are configured per environment. Production error logs are alertable.
