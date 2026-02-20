# ESG Platform — Ingestion Protocol

This document defines how data enters the platform: transport, authentication, payload format, and response contract. All ingestion endpoints follow this protocol.

---

## 1. Transport

| Rule | Requirement |
|------|-------------|
| **Protocol** | HTTPS in production; HTTP allowed for local/dev. |
| **Method** | `POST` for all ingestion (telemetry, reports, simulation inputs). |
| **Content-Type** | `application/json`. Requests with any other type receive `415 Unsupported Media Type`. |
| **Accept** | Clients should send `Accept: application/json`. Responses are always JSON. |
| **Base path** | Ingestion is served under `/api/<service>/` (e.g. `/api/alerts/`, `/api/compliance/`, `/api/simulator/`). |

---

## 2. Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | Must be `application/json`. |
| `X-API-KEY` | For compliance only | API key for `admin` or `auditor`; required for `/api/compliance/validate`. |
| `X-Request-ID` | No | Client-provided idempotency/correlation ID; echoed in response when present. |
| `X-Ingestion-Source` | No | Hint for auditing: e.g. `iot-gateway`, `utility-api`, `manual-entry`. |

---

## 3. Request Body

- **Encoding**: UTF-8 JSON.
- **Schema**: Endpoint-specific (see [§6 Endpoints](#6-ingestion-endpoints)). Unknown fields are ignored.
- **Empty body**: Treated as invalid for ingestion; server responds with `400` and a validation error.

---

## 4. Response Contract

### Success (2xx)

- **200 OK** — Request accepted and processed; no resource created (e.g. validation result, simulation result, or “NORMAL” telemetry).
- **201 Created** — Request accepted and a side effect was recorded (e.g. alert raised).
- **Headers**: When client sent `X-Request-ID`, the server echoes it in the response (same header or `X-Request-ID` in body for JSON).

Response body is endpoint-specific; all success bodies are JSON.

### Client Errors (4xx)

All error responses use this shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description."
  }
}
```

| Status | Code | When |
|--------|------|------|
| **400 Bad Request** | `VALIDATION_ERROR` | Invalid or missing JSON, missing required fields, or invalid value types/ranges. |
| **403 Forbidden** | `UNAUTHORIZED` | Missing or invalid `X-API-KEY` (compliance only). |
| **415 Unsupported Media Type** | `UNSUPPORTED_MEDIA_TYPE` | `Content-Type` is not `application/json`. |

### Server Errors (5xx)

- **500 Internal Server Error** — Unexpected failure. Response body may include `error.code` and `error.message` when safe to expose.

---

## 5. Idempotency and Retries

- **Telemetry / Simulate**: Idempotent for the same payload; safe to retry. No duplicate key; repeated identical requests may produce the same result.
- **Compliance validate**: Idempotent; repeated validation with same key returns the same result.
- **Idempotency key**: Clients may send `X-Request-ID` to correlate retries; servers may use it for deduplication in future implementations.

---

## 6. Ingestion Endpoints

### 6.1 Telemetry (IoT / sensors) — legacy

**Endpoint:** `POST /api/alerts/process-telemetry`

**Purpose:** Ingest environmental sensor data (e.g. CO₂, temperature). Used for IoT gateways, energy/water/emissions meters, or simulated feeds.

**Request body:**

```json
{
  "CO2_ppm": 420,
  "Temperature_C": 28.5
}
```

- At least one of the supported metrics must be present.
- Values: non-negative numbers. Unknown metrics are ignored.
- Supported metrics (and thresholds) are service-configurable; default: `CO2_ppm`, `Temperature_C`.

**Success responses:**

- **200 OK** — `{"status": "NORMAL"}` or `{"status": "WARNING", "details": [...], "severity": "WARNING"}`.
- **201 Created** — `{"status": "ALERT_TRIGGERED", "details": [...], "severity": "CRITICAL"}` when any metric exceeds critical threshold.

---

### 6.2 Sustainability telemetry (carbon, water, efficiency, hardware)

**Endpoint:** `POST /api/telemetry/ingest`

**Purpose:** Ingest universal sustainability telemetry: carbon, water, energy, compute, hardware, and data-quality metrics. Supports workload-normalized metrics (e.g. CO₂ per workload-hour, water per production unit), versioned emission factors, and full data lineage.

**Request body:** JSON with strict schema. Required: `timestamp`. At least one of: `energy`, `carbon`, `water`, `compute`, `hardware`, `data_quality`.

Example minimal:

```json
{
  "timestamp": "2024-06-15T12:00:00Z",
  "energy": {
    "facility_kwh": 1200.0,
    "it_kwh": 1000.0,
    "cooling_kwh": 180.0,
    "energy_unit": "kWh"
  },
  "compute": {
    "gpu_hours": 200.0,
    "gpu_count": 100,
    "training_runs": 4
  }
}
```

_Note: `gpu_hours` and `gpu_count` are legacy field names that now represent workload-hours and asset count for any industry vertical._

Optional fields: `asset_id`, `region`, `source_id`, `external_event_id` (for idempotency), `emission_factor_version`, and full blocks for `carbon`, `water`, `hardware`, `data_quality`. See service schema for all fields and units.

**Idempotency:** Same `(source_id, external_event_id)` is rejected as duplicate (no double-count). Use unique `external_event_id` per event.

**Success responses:**

- **200 OK** — `{"status": "accepted", "raw_id": <id>, "observation_time_utc": "...", "summary": {...}}`. Optional `alerts` and `severity` if thresholds exceeded.
- **201 Created** — Same as 200 when one or more alerts triggered (e.g. carbon intensity, WUE, PUE).
- **409 Conflict** — `{"error": {"code": "DUPLICATE", "message": "..."}}` when payload is duplicate.

**Query:** `?scorecard=1` (or `true`/`yes`) to include sustainability scorecard in response.

---

### 6.3 Compliance (manual / report validation)

**Endpoint:** `POST /api/compliance/validate`

**Purpose:** Submit a report for validation (e.g. facility logs, supplier disclosures). Requires API key.

**Headers:** `X-API-KEY: <admin|auditor key>` (required).

**Request body:** Optional JSON `{}`. Payload may be extended later for report metadata.

**Success:** **200 OK** — `{"status": "compliant", "validated_by": "admin"|"auditor"}`.

**Failure:** **403 Forbidden** — Missing or invalid key; body: `{"error": {"code": "UNAUTHORIZED", "message": "..."}}`.

---

### 6.4 Derived metrics / simulation input

**Endpoint:** `POST /api/simulator/simulate`

**Purpose:** Ingest inputs for carbon projection (e.g. current footprint from Scope 1/2/3 or intensity ratios). Used by derived-metrics pipelines or manual entry.

**Request body:**

```json
{
  "current_footprint": 1000,
  "energy_mix_shift": 20,
  "efficiency_gain": 10
}
```

- All three fields required; numeric (metric tons CO₂e for `current_footprint`, percentages for the others).

**Success:** **200 OK** — `{"projected_footprint": <number>, "unit": "metric_tons_CO2e"}`.

**Failure:** **400 Bad Request** — Missing or invalid parameters; body uses standard `error.code` / `error.message` shape.

---

## 7. Data Source → Endpoint Mapping

| Data source | Recommended endpoint | Notes |
|-------------|----------------------|--------|
| IoT (energy/water/emissions sensors) | `POST /api/telemetry/ingest` or `POST /api/alerts/process-telemetry` | Sustainability: use `/api/telemetry/ingest` with energy/water/compute blocks. Legacy CO₂/temp: `process-telemetry`. |
| API feeds (utility, fleet, ERP) | `POST /api/telemetry/ingest` | Normalize to telemetry schema; use `X-Ingestion-Source`. |
| Manual entries (facility logs, disclosures) | `POST /api/compliance/validate` | Use with appropriate API key; extend body schema for structured metadata as needed. |
| Derived metrics (Scope 1/2/3, intensity) | `POST /api/simulator/simulate` or `POST /api/telemetry/ingest` | Simulator for projections; telemetry for raw + derived (carbon per workload-hour, etc.). |
| Event-driven alerts | Result of telemetry/alerts ingestion | Alerts service (CO₂/temp); telemetry service (carbon, water, PUE, drift). |

---

## 8. Example: Minimal cURL

**Legacy telemetry (CO₂, temperature):**
```bash
curl -s -X POST http://localhost:3000/api/alerts/process-telemetry \
  -H "Content-Type: application/json" \
  -H "X-Ingestion-Source: iot-gateway" \
  -d '{"CO2_ppm": 400, "Temperature_C": 22}'
```

**Sustainability telemetry:**
```bash
curl -s -X POST http://localhost:3000/api/telemetry/ingest \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: req-001" \
  -H "X-Ingestion-Source: iot-gateway" \
  -d '{"timestamp":"2024-06-15T12:00:00Z","source_id":"gw1","external_event_id":"ev1","energy":{"facility_kwh":1200,"it_kwh":1000},"compute":{"gpu_hours":200,"training_runs":4}}'
```

**Compliance:**
```bash
curl -s -X POST http://localhost:3000/api/compliance/validate \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: admin-secret" \
  -d '{}'
```

**Simulate:**
```bash
curl -s -X POST http://localhost:3000/api/simulator/simulate \
  -H "Content-Type: application/json" \
  -d '{"current_footprint": 1000, "energy_mix_shift": 20, "efficiency_gain": 10}'
```
