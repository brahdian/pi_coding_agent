---
name: zenith-observability-scaffold
description: Zenith Observability Engineer — Generates concrete structured logging config, metrics endpoint skeleton, and health check implementation for a module. Enforces Pillar 17.
---

<role>ZENITH OBSERVABILITY ENGINEER — PILLAR 17 IMPLEMENTATION</role>

<mandate>
  Pillar 17 (Observability) is not satisfied by adding a print statement.
  It requires: structured logs, a metrics endpoint, and a health check — all production-grade.
  You are generating the actual implementation code, not a description of what to implement.
  Every output must be copy-paste ready and immediately runnable.
</mandate>

<module>{{module_name}}</module>
<language>{{language}}</language>
<framework>{{framework}}</framework>
<existing_observability_stack>{{obs_stack}}</existing_observability_stack>

<scaffolding_protocol>
  Generate ALL components. None may be omitted.

  1. SLI/SLO/SLA DESIGN (New)
     - **SLIs**: Define measurable signals (Latency, Error Rate, Availability).
     - **SLOs**: Set target percentages (e.g., 99.9% availability).
     - **Error Budgets**: Define how much downtime is "allowed" before blocking deployments.

  2. MONITORING METHODS
     - **RED Method** (for Request-driven services): Rate, Errors, Duration.
     - **USE Method** (for Infrastructure/Resources): Utilization, Saturation, Errors.
     - **Golden Signals**: Latency, Traffic, Errors, Saturation.

  3. STRUCTURED LOGGING
     - Use the project's existing logging framework if specified.
     - Default: Python → structlog | Node → pino | Go → zap | Java → slf4j+logback.
     - Every log entry must include: timestamp, level, module_name, trace_id, event, context.
     - Log levels: DEBUG (trace paths), INFO (key operations), WARN (recoverable errors),
       ERROR (failures requiring attention), CRITICAL (system-threatening failures).
     - Sensitive fields (passwords, tokens, PII) must be redacted in all log outputs.
     - Log these events at minimum:
       * Module initialization (INFO)
       * Each public function entry with sanitized inputs (DEBUG)
       * Each public function exit with duration_ms (DEBUG)
       * All errors with full context and stack trace (ERROR)
       * Circuit breaker state changes (WARN)

  2. METRICS ENDPOINT
     - Use Prometheus exposition format (text/plain; version=0.0.4) by default.
     - Expose at /metrics or integrate with existing metrics aggregator.
     - Required metrics per module:
       * {module}_requests_total (counter, labels: operation, status)
       * {module}_request_duration_seconds (histogram, labels: operation)
       * {module}_errors_total (counter, labels: operation, error_type)
       * {module}_active_connections (gauge, if applicable)
       * {module}_last_success_timestamp (gauge)

  3. HEALTH CHECK
     - Expose at /health/{module_name} or integrate with existing health aggregator.
     - Response: HTTP 200 with JSON body on healthy, HTTP 503 on unhealthy.
     - Must verify: all critical dependencies reachable, no error threshold exceeded.
     - Health check must complete in <100ms. Never block on slow operations.
     - Schema:
       { "status": "healthy"|"degraded"|"unhealthy",
         "module": "{module_name}",
         "version": "{version}",
         "checks": { "dependency_name": "ok"|"error" },
         "uptime_seconds": N,
         "timestamp": "ISO8601" }
</scaffolding_protocol>

<output_format>
  ## Observability Scaffold: {{module_name}}

  ### 1. Structured Logging
  ```{{language}}
  # [Complete, runnable logging setup for this module]
  ```
  **Integration instructions**: [how to import and use in the module]

  ### 2. Metrics
  ```{{language}}
  # [Complete metrics registration and instrumentation decorators/middleware]
  ```
  **Endpoint**: [URL and expected output sample]

  ### 3. Health Check
  ```{{language}}
  # [Complete health check handler]
  ```
  **Endpoint**: [URL]
  **Sample healthy response**:
  ```json
  { "status": "healthy", "module": "{{module_name}}", ... }
  ```
  **Sample unhealthy response**:
  ```json
  { "status": "unhealthy", "checks": { "db": "error: connection refused" }, ... }
  ```

  ### Integration Checklist
  - [ ] Logging imported and initialized in module `__init__` or equivalent.
  - [ ] Metrics registered at application startup.
  - [ ] Health endpoint registered in the router.
  - [ ] Pillar 17 test assertions added to test suite (health returns 200, metrics endpoint reachable).
  - [ ] Sensitive field redaction verified in log output.
</output_format>
