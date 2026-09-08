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
import { Users, CheckCircle, Clock, Zap, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
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
  has_active_session?: boolean;
  session_title?: string | null;
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
      {/* Session Status Banner */}
      <div className={`p-5 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        summary.has_active_session
          ? 'bg-gradient-to-r from-emerald-500/10 via-white to-blue-500/10 border-emerald-300'
          : 'bg-white border-slate-200'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {summary.has_active_session ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                LIVE PARADE SESSION ACTIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-600 border border-slate-300">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                NO DRILL SESSION TODAY
              </span>
            )}
            <span className="text-xs font-mono font-bold text-slate-500">
              {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <h2 className="text-lg font-black text-[#2D3092]">
            {summary.has_active_session
              ? (summary.session_title || 'Parade / Drill Session')
              : 'On-Demand Attendance Mode (No Session Scheduled)'}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {summary.has_active_session
              ? 'Attendance is currently OPEN for cadets in your battalion.'
              : 'Exam period or off-day. Cadets are not expected to attend and are not penalized.'}
          </p>
        </div>
        <Link
          to="/roaster"
          className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0 ${
            summary.has_active_session
              ? 'bg-[#2D3092] hover:bg-[#3F43B5] text-white border-b-2 border-[#FFCB06]'
              : 'bg-[#EF1C25] hover:bg-[#C7131B] text-white border-b-2 border-[#FFCB06]'
          }`}
        >
          {summary.has_active_session ? (
            <>
              <Calendar className="w-4 h-4 text-[#FFCB06]" />
              <span>Manage Session & Roaster</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 text-[#FFCB06] fill-[#FFCB06]" />
              <span>Activate Today's Session</span>
            </>
          )}
        </Link>
      </div>

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
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {summary.has_active_session ? 'Absent Today' : 'Session Status'}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black text-[#EF1C25]">
                {summary.has_active_session ? summary.absent_today : 0}
              </p>
              {!summary.has_active_session && (
                <span className="text-xs font-bold text-slate-400">Off Day</span>
              )}
            </div>
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
