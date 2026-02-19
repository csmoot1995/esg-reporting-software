// Import necessary libraries
import './style.css';
import { NAV_LINKS, SECTIONS } from './config.js';
import { api } from './api.js';

console.log('Hello, ESG Platform!');

// Create the main application container
const app = document.createElement('div');
app.id = 'app';
app.style.fontFamily = 'Arial, sans-serif';
app.style.margin = '20px';
document.body.appendChild(app);

// Create a navigation bar
const navBar = document.createElement('nav');
navBar.style.display = 'flex';
navBar.style.justifyContent = 'space-around';
navBar.style.backgroundColor = '#333';
navBar.style.color = '#fff';
navBar.style.padding = '10px';

NAV_LINKS.forEach((link) => {
  const navItem = document.createElement('a');
  navItem.textContent = link;
  navItem.href = `#${link.toLowerCase()}`;
  navItem.style.color = '#fff';
  navItem.style.textDecoration = 'none';
  navItem.style.margin = '0 10px';
  navBar.appendChild(navItem);
});
app.appendChild(navBar);

// Helper: show message in an element (success or error)
function setResult(el, message, isError = false) {
  el.textContent = message;
  el.className = isError ? 'result result-error' : 'result result-success';
  el.style.display = 'block';
}

// --- Dashboard section ---
const dashboardSection = document.createElement('section');
dashboardSection.id = 'dashboard';
dashboardSection.style.marginTop = '20px';
const dashboardHeader = document.createElement('h2');
dashboardHeader.textContent = 'Dashboard';
dashboardSection.appendChild(dashboardHeader);
const dashboardIntro = document.createElement('p');
dashboardIntro.textContent = SECTIONS.dashboard;
dashboardSection.appendChild(dashboardIntro);

const statusDiv = document.createElement('div');
statusDiv.className = 'backend-status';
statusDiv.innerHTML = '<strong>Backend status:</strong> <span id="status-text">Checking…</span>';
dashboardSection.appendChild(statusDiv);

const telemetryDiv = document.createElement('div');
telemetryDiv.className = 'dashboard-form';
telemetryDiv.style.marginTop = '16px';
telemetryDiv.innerHTML = `
  <strong>Test alerts (telemetry):</strong>
  <form id="telemetry-form" class="form-inline">
    <label>CO₂ ppm <input type="number" name="CO2_ppm" value="400" step="1" /></label>
    <label>Temperature °C <input type="number" name="Temperature_C" value="30" step="0.1" /></label>
    <button type="submit">Submit telemetry</button>
  </form>
  <div id="telemetry-result" class="result" style="display:none;"></div>
`;
dashboardSection.appendChild(telemetryDiv);
app.appendChild(dashboardSection);

// Check backend health and update status
async function refreshBackendStatus() {
  const statusEl = document.getElementById('status-text');
  const services = [
    { name: 'Alerts', path: 'alerts' },
    { name: 'Compliance', path: 'compliance' },
    { name: 'Simulator', path: 'simulator' }
  ];
  const results = await Promise.allSettled(
    services.map((s) => api.health(s.path).then(() => s.name))
  );
  const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed === 0) {
    statusEl.textContent = `All services up (${ok.join(', ')}).`;
    statusEl.style.color = 'green';
  } else {
    statusEl.textContent = `${ok.length} up (${ok.join(', ') || 'none'}), ${failed} unreachable. Run backends or use Docker.`;
    statusEl.style.color = 'orange';
  }
}
refreshBackendStatus();

document.getElementById('telemetry-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const resultEl = document.getElementById('telemetry-result');
  const form = e.target;
  const body = {
    CO2_ppm: Number(form.CO2_ppm.value),
    Temperature_C: Number(form.Temperature_C.value)
  };
  try {
    const data = await api.processTelemetry(body);
    if (data.status === 'ALERT_TRIGGERED') {
      setResult(resultEl, `Alerts: ${JSON.stringify(data.details, null, 2)}`, false);
    } else {
      setResult(resultEl, 'Status: NORMAL – no alerts triggered.', false);
    }
  } catch (err) {
    setResult(resultEl, `Error: ${err.message}`, true);
  }
});

// --- Compliance section ---
const complianceSection = document.createElement('section');
complianceSection.id = 'compliance';
complianceSection.style.marginTop = '20px';
complianceSection.innerHTML = `
  <h2>Compliance</h2>
  <p>${SECTIONS.compliance}</p>
  <div class="form-block">
    <form id="compliance-form">
      <label>API Key (admin or auditor) <input type="password" name="api_key" placeholder="X-API-KEY" required /></label>
      <button type="submit">Validate report</button>
    </form>
    <div id="compliance-result" class="result" style="display:none;"></div>
  </div>
`;
app.appendChild(complianceSection);

document.getElementById('compliance-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const resultEl = document.getElementById('compliance-result');
  const apiKey = e.target.api_key.value.trim();
  if (!apiKey) return;
  try {
    const data = await api.validateReport(apiKey);
    setResult(resultEl, `Status: ${data.status}, validated by: ${data.validated_by}`, false);
  } catch (err) {
    setResult(resultEl, err.status === 403 ? 'Unauthorized (invalid API key)' : err.message, true);
  }
});

// --- Simulator section ---
const simulatorSection = document.createElement('section');
simulatorSection.id = 'simulator';
simulatorSection.style.marginTop = '20px';
simulatorSection.innerHTML = `
  <h2>Simulator</h2>
  <p>${SECTIONS.simulator}</p>
  <div class="form-block">
    <form id="simulator-form">
      <label>Current footprint (metric tons CO₂e) <input type="number" name="current_footprint" value="1000" step="0.01" required /></label>
      <label>Energy mix shift (% renewables) <input type="number" name="energy_mix_shift" value="20" min="0" max="100" step="0.1" /></label>
      <label>Efficiency gain (%) <input type="number" name="efficiency_gain" value="10" min="0" max="100" step="0.1" /></label>
      <button type="submit">Run simulation</button>
    </form>
    <div id="simulator-result" class="result" style="display:none;"></div>
  </div>
`;
app.appendChild(simulatorSection);

document.getElementById('simulator-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const resultEl = document.getElementById('simulator-result');
  const form = e.target;
  try {
    const data = await api.simulate({
      current_footprint: form.current_footprint.value,
      energy_mix_shift: form.energy_mix_shift.value,
      efficiency_gain: form.efficiency_gain.value
    });
    setResult(
      resultEl,
      `Projected footprint: ${data.projected_footprint} ${data.unit}`,
      false
    );
  } catch (err) {
    setResult(resultEl, `Error: ${err.message}`, true);
  }
});
