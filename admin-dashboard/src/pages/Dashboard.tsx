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

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [summaryRes, trendsRes] = await Promise.all([
          api.get('/analytics/'),
          api.get('/analytics/trends')
        ]);
        setSummary(summaryRes.data);
        setTrends(trendsRes.data);
      } catch {
        console.error("Failed to fetch analytics");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <div>Loading dashboard...</div>;
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
        backgroundColor: ['#10B981', '#EF4444', '#F59E0B'],
        borderWidth: 0,
      },
    ],
  };

  const lineData = {
    labels: trends.dates,
    datasets: [
      {
        label: 'Daily Attendance',
        data: trends.counts,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.3,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Staff</p>
            <p className="text-2xl font-bold text-gray-900">{summary.total_staff}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-lg">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Present Today</p>
            <p className="text-2xl font-bold text-gray-900">{summary.present_today}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Late Arrivals</p>
            <p className="text-2xl font-bold text-gray-900">{summary.late_today}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-red-100 text-red-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Absent Today</p>
            <p className="text-2xl font-bold text-gray-900">{summary.absent_today}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">30-Day Attendance Trend</h3>
          <div className="h-72">
            <Line
              data={lineData}
              options={{ maintainAspectRatio: false }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Today's Ratio</h3>
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
