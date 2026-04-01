import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, AlertCircle, RefreshCw, Clock, User, CheckCircle2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface RoasterRecord {
  id: number;
  user_id: number;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_leave: boolean;
  is_week_off: boolean;
}

interface RoasterData {
  id: number;
  userName: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isLeave: boolean;
  isWeekOff: boolean;
}

export const TodayRoaster: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [roasterData, setRoasterData] = useState<RoasterData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'timeline' | 'table'>('card');

  // Fetch roaster data
  const fetchRoaster = async (date: string) => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await api.get(`/roaster/?date=${date}`);
      const transformedData = response.data.map((record: RoasterRecord) => ({
        id: record.id,
        userName: `Staff ${record.user_id}`, // Will be replaced with actual name from user query
        date: record.date,
        startTime: record.start_time,
        endTime: record.end_time,
        isLeave: record.is_leave,
        isWeekOff: record.is_week_off,
      }));
      setRoasterData(transformedData);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to fetch roaster data';
      setError(errorMsg);
      console.error('Roaster fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on date change
  useEffect(() => {
    fetchRoaster(selectedDate);
  }, [selectedDate]);

  // Date navigation
  const handlePreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Statistics
  const stats = useMemo(() => {
    return {
      total: roasterData.length,
      scheduled: roasterData.filter(r => !r.isLeave && !r.isWeekOff).length,
      onLeave: roasterData.filter(r => r.isLeave).length,
      weekOff: roasterData.filter(r => r.isWeekOff).length,
    };
  }, [roasterData]);

  // Format date for display
  const displayDate = new Date(selectedDate).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Empty state
  if (!loading && roasterData.length === 0 && !error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
            <Calendar className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900">
            No Roaster Found
          </h3>
          <p className="text-sm text-slate-600 max-w-xs">
            No schedules have been created for {displayDate}. Create one to get started.
          </p>
          <button
            onClick={() => navigate('/roaster-management')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Schedule
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-20 sm:pb-6">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Title and controls */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Staff Roaster
          </h1>
          <button
            onClick={() => fetchRoaster(selectedDate)}
            disabled={loading}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Date navigation */}
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-2xl p-3 sm:p-4 backdrop-blur-sm">
          <button
            onClick={handlePreviousDay}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </button>
          <div className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs sm:text-sm font-medium text-slate-600 uppercase tracking-wider">
              {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'short' })}
            </span>
            <span className="text-base sm:text-lg font-semibold text-slate-900">
              {new Date(selectedDate).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: '2-digit',
              })}
            </span>
          </div>
          <button
            onClick={handleToday}
            className="px-3 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
          >
            Today
          </button>
          <button
            onClick={handleNextDay}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'indigo' },
            { label: 'Scheduled', value: stats.scheduled, color: 'emerald' },
            { label: 'On Leave', value: stats.onLeave, color: 'amber' },
            { label: 'Week Off', value: stats.weekOff, color: 'slate' },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-3 rounded-xl border border-${stat.color}-200 bg-gradient-to-br from-${stat.color}-50 to-${stat.color}-100/50 backdrop-blur-sm`}
            >
              <p className={`text-xs font-medium text-${stat.color}-700 uppercase tracking-wider`}>
                {stat.label}
              </p>
              <p className={`text-2xl font-bold text-${stat.color}-900 mt-1`}>
                {stat.value}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Error state */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium">{error}</p>
            <button
              onClick={() => fetchRoaster(selectedDate)}
              className="text-sm underline mt-1 hover:text-red-700"
            >
              Try again
            </button>
          </div>
        </motion.div>
      )}

      {/* Loading state */}
      {loading && <RoasterSkeleton count={6} />}

      {/* Roaster cards grid */}
      {!loading && roasterData.length > 0 && (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
        >
          <AnimatePresence mode="popLayout">
            {roasterData.map((record) => (
              <RoasterCard
                key={record.id}
                id={record.id}
                userName={record.userName}
                date={record.date}
                startTime={record.startTime}
                endTime={record.endTime}
                isLeave={record.isLeave}
                isWeekOff={record.isWeekOff}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Floating Action Button for mobile */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/roaster-management')}
        className="fixed bottom-6 right-6 sm:hidden z-40 w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-2xl flex items-center justify-center hover:shadow-3xl transition-all"
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </div>
  );
};

export default TodayRoaster;
