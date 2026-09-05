import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { Users, CheckCircle, Clock } from 'lucide-react';
import api from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface SummaryData {
  total_staff: number;
  present_today: number;
  late_today: number;
  absent_today: number;
}

interface TrendData {
  dates: string[];
  counts: number[];
}

const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setError(null);
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token. Please log in again.');
        }
        
        const [summaryRes, trendsRes] = await Promise.all([
          api.get('/analytics/'),
          api.get('/analytics/trends')
        ]);
        setSummary(summaryRes.data);
        setTrends(trendsRes.data);
      } catch (err: unknown) {
        let errorMsg = 'Failed to fetch analytics';
        if (err instanceof Error) {
          errorMsg = err.message;
        }
        setError(errorMsg);
        console.error("Failed to fetch analytics", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <div className="text-red-600">Error: {error}</div>;
  if (!summary || !trends) return <div>Failed to load data.</div>;

  const donutData = {
    labels: ['Present', 'Absent', 'Late'],
    datasets: [
      {
        data: [
          summary.present_today - summary.late_today, 
          summary.absent_today, 
          summary.late_today
        ],
        backgroundColor: ['#00AEEF', '#EF1C25', '#FFCB06'],
        borderWidth: 0,
      },
    ],
  };

  const lineData = {
    labels: trends.dates,
    datasets: [
      {
        label: 'Daily Cadet Attendance',
        data: trends.counts,
        borderColor: '#2D3092',
        backgroundColor: 'rgba(45, 48, 146, 0.2)',
        tension: 0.3,
        fill: true,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-6 border-t-4 border-[#2D3092] border-x border-b border-slate-200 flex items-center space-x-4">
          <div className="p-3.5 bg-[#2D3092]/10 text-[#2D3092] rounded-xl font-bold">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Cadets</p>
            <p className="text-3xl font-black text-[#2D3092]">{summary.total_staff}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border-t-4 border-[#00AEEF] border-x border-b border-slate-200 flex items-center space-x-4">
          <div className="p-3.5 bg-[#00AEEF]/10 text-[#00AEEF] rounded-xl font-bold">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Present Today</p>
            <p className="text-3xl font-black text-[#00AEEF]">{summary.present_today}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border-t-4 border-[#FFCB06] border-x border-b border-slate-200 flex items-center space-x-4">
          <div className="p-3.5 bg-[#FFCB06]/20 text-[#D9AB00] rounded-xl font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Late Arrivals</p>
            <p className="text-3xl font-black text-[#D9AB00]">{summary.late_today}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border-t-4 border-[#EF1C25] border-x border-b border-slate-200 flex items-center space-x-4">
          <div className="p-3.5 bg-[#EF1C25]/10 text-[#EF1C25] rounded-xl font-bold">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Absent Today</p>
            <p className="text-3xl font-black text-[#EF1C25]">{summary.absent_today}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 border-t-4 border-t-[#2D3092] lg:col-span-2">
          <h3 className="text-base font-black text-[#2D3092] uppercase tracking-wider mb-4">30-Day Cadet Attendance Trend</h3>
          <div className="h-72">
            <Line
              data={lineData}
              options={{ maintainAspectRatio: false }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 border-t-4 border-t-[#EF1C25]">
          <h3 className="text-base font-black text-[#2D3092] uppercase tracking-wider mb-4">Today's Session Ratio</h3>
          <div className="h-64 flex justify-center">
            <Doughnut
              data={donutData}
              options={{ maintainAspectRatio: false, cutout: '70%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
