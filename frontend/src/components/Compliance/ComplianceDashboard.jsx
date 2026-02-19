import { useState, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { validateReport, health } from '../../api/compliance';
import { canValidate, canDelete } from '../../config';
import PageHeader from '../shared/PageHeader';

const STEPS = ['Pending', 'Audited', 'Compliant'];

export default function ComplianceDashboard() {
  const [reportFile, setReportFile] = useState(null);
  const [reportName, setReportName] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const fileInputRef = useRef(null);

  const validateMutation = useMutation({
    mutationFn: () => validateReport(apiKey),
    onSuccess: () => {
      if (stepIndex < 2) setStepIndex(1);
    },
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setReportFile(file);
      setReportName(file.name);
      setStepIndex(0);
    }
  };

  const handleValidate = (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    validateMutation.mutate();
  };

  const handleMarkCompliant = () => {
    setStepIndex(2);
  };

  const handleDelete = () => {
    setReportFile(null);
    setReportName('');
    setStepIndex(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const healthQuery = useQuery({
    queryKey: ['compliance-health'],
    queryFn: health,
    retry: 1,
    refetchInterval: 30_000,
  });

  const showValidate = canValidate() && stepIndex === 0;
  const showDelete = canDelete() && reportFile;
  const showMarkCompliant = canValidate() && stepIndex === 1;

  return (
    <section className="space-y-8">
      <PageHeader
        title="Compliance Dashboard"
        description="Upload ESG reports and validate compliance. Role-based actions apply."
        status={healthQuery.isError ? 'error' : 'success'}
        isLoading={healthQuery.isLoading}
      />

      {/* Contextual Info */}
      <div className="card p-4 bg-esg-mint/10 border-l-4 border-esg-sage">
        <p className="text-sm text-esg-sage/90">
          <strong className="text-esg-forest">Tip:</strong> Validated reports contribute to your sustainability scorecard.{' '}
          <Link to="/telemetry" className="text-esg-sage hover:underline font-medium">
            View telemetry dashboard →
          </Link>
        </p>
      </div>

      <div className="card p-6">
        {/* File upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-esg-forest mb-2">ESG Report</label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.xlsx,.json"
              onChange={handleFileChange}
              className="block w-full text-sm text-esg-forest file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-esg-mint/30 file:text-esg-forest file:font-medium hover:file:bg-esg-mint/50"
            />
            {reportName && (
              <span className="text-sm text-esg-sage">
                {reportName}
              </span>
            )}
          </div>
        </div>

        {/* Status stepper */}
        <div className="mb-6">
          <span className="block text-sm font-medium text-esg-forest mb-3">Report status</span>
          <div className="flex items-center gap-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center flex-1">
                <div
                  className={`
                    flex items-center justify-center rounded-full w-9 h-9 text-sm font-medium border-2 shrink-0
                    ${i < stepIndex ? 'bg-esg-success border-esg-success text-white' : ''}
                    ${i === stepIndex ? 'border-esg-sage bg-esg-sage text-white' : ''}
                    ${i > stepIndex ? 'border-esg-mint/50 bg-esg-cream text-esg-sage/70' : ''}
                  `}
                >
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    i <= stepIndex ? 'text-esg-forest' : 'text-esg-sage/70'
                  }`}
                >
                  {label}
                </span>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded ${
                      i < stepIndex ? 'bg-esg-success' : 'bg-esg-mint/30'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* API Key (for validate) */}
        {(showValidate || showMarkCompliant) && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-esg-forest mb-1">API Key (admin or auditor)</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="X-API-KEY"
              className="input-field max-w-xs"
            />
          </div>
        )}

        {/* Actions: Validate, Mark Compliant, Delete — hidden for viewer */}
        <div className="flex flex-wrap gap-3">
          {showValidate && (
            <button
              type="button"
              onClick={handleValidate}
              disabled={!apiKey.trim() || validateMutation.isPending || healthQuery.isError}
              className="btn-primary"
            >
              {validateMutation.isPending ? 'Validating…' : 'Validate'}
            </button>
          )}
          {showMarkCompliant && (
            <button type="button" onClick={handleMarkCompliant} className="btn-primary">
              Mark Compliant
            </button>
          )}
          {showDelete && (
            <button type="button" onClick={handleDelete} className="btn-secondary">
              Delete
            </button>
          )}
        </div>

        {validateMutation.isError && (
          <p className="mt-3 text-sm text-esg-alert">
            {validateMutation.error?.status === 403
              ? 'Unauthorized (invalid API key).'
              : validateMutation.error?.message}
          </p>
        )}
        {validateMutation.isSuccess && (
          <p className="mt-3 text-sm text-esg-success">
            Validated by: {validateMutation.data?.validated_by}.
          </p>
        )}
      </div>
    </section>
  );
}
