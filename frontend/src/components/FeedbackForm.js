/* src/components/FeedbackForm.js */
import React, { useState } from 'react';

export default function FeedbackForm({ deviceId, onSubmit }){
  const [rating, setRating] = useState('');
  const [feedback, setFeedback] = useState('');
  const [actualRisk, setActualRisk] = useState('');

  return (
    <div className="bg-white rounded shadow-md p-4">
      <h3 className="text-lg font-semibold mb-3">Submit Feedback</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Rating (1-5)</label>
          <select value={rating} onChange={(e)=>setRating(e.target.value)} className="w-full border rounded px-3 py-2">
            <option value="">Select</option>
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Actual Risk</label>
          <select value={actualRisk} onChange={(e)=>setActualRisk(e.target.value)} className="w-full border rounded px-3 py-2">
            <option value="">Optional</option>
            {['Low','Medium','High'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium mb-1">Feedback</label>
          <textarea value={feedback} onChange={(e)=>setFeedback(e.target.value)} className="w-full border rounded px-3 py-2" rows={3} />
        </div>
      </div>
      <div className="mt-3">
        <button className="bg-brand-blue text-white px-4 py-2 rounded" onClick={() => onSubmit?.({ rating, feedback, actual_risk: actualRisk, device_id: deviceId })}>Submit</button>
      </div>
    </div>
  );
}
