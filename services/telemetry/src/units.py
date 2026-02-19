"""
Unit normalization for ESG telemetry. All ingestion is normalized to canonical units:
- Energy: kWh
- Water: liters
- Compute: GPU-hours (and run counts)
- Mass/carbon: kg CO2e
- Time: seconds (internal), hours for reporting
"""
from __future__ import annotations

# Canonical units
ENERGY_CANONICAL = "kWh"
WATER_CANONICAL = "liters"
CARBON_CANONICAL = "kg_co2e"
TIME_HOURS = "hours"
TIME_SECONDS = "seconds"

# Conversion factors to canonical
ENERGY_TO_KWH = {
    "kWh": 1.0,
    "MWh": 1000.0,
    "Wh": 0.001,
    "GWh": 1_000_000.0,
}

WATER_TO_LITERS = {
    "liters": 1.0,
    "L": 1.0,
    "m3": 1000.0,
    "cubic_meters": 1000.0,
    "gallons": 3.78541,
    "gal": 3.78541,
}

TIME_TO_SECONDS = {
    "seconds": 1.0,
    "s": 1.0,
    "minutes": 60.0,
    "min": 60.0,
    "hours": 3600.0,
    "h": 3600.0,
    "gpu_hours": 3600.0,  # 1 GPU-hour = 3600 seconds of 1 GPU
}


def normalize_energy(value: float, unit: str = "kWh") -> float:
    """Convert energy to kWh. Raises ValueError for unknown unit."""
    u = (unit or "kWh").strip()
    if u not in ENERGY_TO_KWH:
        raise ValueError(f"Unknown energy unit: {unit}. Supported: {list(ENERGY_TO_KWH)}")
    return float(value) * ENERGY_TO_KWH[u]


def normalize_water(value: float, unit: str = "liters") -> float:
    """Convert water volume to liters."""
    u = (unit or "liters").strip()
    if u not in WATER_TO_LITERS:
        raise ValueError(f"Unknown water unit: {unit}. Supported: {list(WATER_TO_LITERS)}")
    return float(value) * WATER_TO_LITERS[u]


def normalize_time_to_seconds(value: float, unit: str = "seconds") -> float:
    """Convert time to seconds."""
    u = (unit or "seconds").strip()
    if u not in TIME_TO_SECONDS:
        raise ValueError(f"Unknown time unit: {unit}. Supported: {list(TIME_TO_SECONDS)}")
    return float(value) * TIME_TO_SECONDS[u]


def seconds_to_gpu_hours(seconds: float, gpu_count: float = 1.0) -> float:
    """Convert elapsed seconds and GPU count to GPU-hours. 1 GPU for 1 hour = 1 GPU-hour."""
    if gpu_count <= 0:
        return 0.0
    return float(seconds) / 3600.0 * float(gpu_count)


def gpu_hours_to_seconds(gpu_hours: float, gpu_count: float = 1.0) -> float:
    """Convert GPU-hours back to wall-clock seconds for gpu_count GPUs."""
    if gpu_count <= 0:
        return 0.0
    return float(gpu_hours) * 3600.0 / float(gpu_count)
