"""
Carbon footprint projection formula for ESG what-if scenarios.
Pure logic, no Flask dependency, for testing and reuse.
"""
MIN_FOOTPRINT = 0.0
MAX_FOOTPRINT = 1e9
MIN_PCT = 0.0
MAX_PCT = 100.0


def calculate_projection(
    current_footprint: float, energy_mix_shift: float, efficiency_gain: float
) -> float:
    """
    Project carbon footprint after efficiency and energy-mix interventions.

    C_projected = C_current × (1 - efficiency_gain/100) × (1 - energy_mix_shift/100)
    Inputs are clamped to valid ranges. Returns metric tons CO₂e.
    """
    c = max(MIN_FOOTPRINT, min(MAX_FOOTPRINT, float(current_footprint)))
    m = max(MIN_PCT, min(MAX_PCT, float(energy_mix_shift))) / 100.0
    e = max(MIN_PCT, min(MAX_PCT, float(efficiency_gain))) / 100.0
    projected = c * (1.0 - e) * (1.0 - m)
    return round(max(0.0, projected), 2)
