/* src/components/RiskChart.js */
import React, { useEffect, useRef } from 'react';

export function PieChart({ data }){
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!window.Chart) return;
    const ctx = canvasRef.current.getContext('2d');
    const chart = new window.Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Low', 'Medium', 'High'],
        datasets: [{
          data: [data.Low || 0, data.Medium || 0, data.High || 0],
          backgroundColor: ['#22C55E', '#FBBF24', '#EF4444'],
          borderColor: ['#14532D', '#854D0E', '#991B1B'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Risk Probability Breakdown' }
        }
      }
    });
    return () => chart.destroy();
  }, [data]);

  return <canvas ref={canvasRef} className="w-full h-64" />
}

export function BarChart({ counts }){
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!window.Chart) return;
    const ctx = canvasRef.current.getContext('2d');
    const chart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Low Risk', 'Medium Risk', 'High Risk'],
        datasets: [{
          label: 'Device Count',
          data: [counts.low || 0, counts.medium || 0, counts.high || 0],
          backgroundColor: ['#22C55E', '#FBBF24', '#EF4444'],
          borderColor: ['#14532D', '#854D0E', '#991B1B'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' }, title: { display: true, text: 'Device Risk Distribution' } },
        scales: { y: { beginAtZero: true } }
      }
    });
    return () => chart.destroy();
  }, [counts]);

  return <canvas ref={canvasRef} className="w-full h-64" />
}
