/* src/pages/RiskAssessmentResult.js */
import React from 'react';
import { PieChart } from '../components/RiskChart.js';

export default function RiskAssessmentResult(){
  const last = JSON.parse(localStorage.getItem('lastPrediction') || 'null');
  if (!last) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded shadow p-6">No result found. Please run a prediction first.</div>
      </main>
    );
  }

  const riskColor = last.risk_class === 'High' ? 'text-brand-red' : last.risk_class === 'Medium' ? 'text-brand-yellow' : 'text-brand-green';
  const probs = last.probabilities || { Low: last.risk_class === 'Low' ? last.risk_percent : 0, Medium: last.risk_class === 'Medium' ? last.risk_percent : 0, High: last.risk_class === 'High' ? last.risk_percent : 0 };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="bg-white rounded shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Risk Assessment Result</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500">Device</div>
            <p className="font-semibold">{last.device_name}</p>
          </div>
          <div>
            <div className="text-xs text-gray-500">Manufacturer</div>
            <p className="font-semibold">{last.manufacturer_name}</p>
          </div>
          <div>
            <div className="text-xs text-gray-500">Risk Class</div>
            <p className={`font-semibold ${riskColor}`}>{last.risk_class} ({(last.risk_percent || 0).toFixed(1)}%)</p>
          </div>
        </div>
        <div className="mt-6">
          <PieChart data={probs} />
        </div>
      </div>

      {Array.isArray(last.suggested_alternatives) && last.suggested_alternatives.length > 0 && (
        <div className="bg-white rounded shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Suggested Alternatives</h3>
          <ul className="list-disc pl-5 space-y-1">
            {last.suggested_alternatives.map((a,i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}
    </main>
  );
}
