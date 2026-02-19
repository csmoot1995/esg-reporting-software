import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import OverviewDashboard from './components/Dashboard/OverviewDashboard';
import ComplianceDashboard from './components/Compliance/ComplianceDashboard';
import AlertMonitor from './components/Alerts/AlertMonitor';
import WhatIfSimulator from './components/Simulator/WhatIfSimulator';
import TelemetryIngestionPortal from './components/Telemetry/TelemetryIngestionPortal';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<OverviewDashboard />} />
          <Route path="/compliance" element={<ComplianceDashboard />} />
          <Route path="/alerts" element={<AlertMonitor />} />
          <Route path="/simulator" element={<WhatIfSimulator />} />
          <Route path="/telemetry" element={<TelemetryIngestionPortal />} />
          <Route path="/ingestion" element={<TelemetryIngestionPortal />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
