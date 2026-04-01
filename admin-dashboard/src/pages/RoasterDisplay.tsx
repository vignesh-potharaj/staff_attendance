import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, AlertCircle, RefreshCw, Clock, User, CheckCircle2 } from 'lucide-react';
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

/* Skeleton Loader Component */
const RoasterSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 backdrop-blur-sm bg-white/50 overflow-hidden"
        >
          <div className="p-4 sm:p-5 md:p-6 space-y-4 animate-pulse">
            {/* Header skeleton */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-slate-200 to-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded-lg w-32" />
                  <div className="h-3 bg-slate-100 rounded w-24" />
                </div>
              </div>
              <div className="h-6 bg-slate-200 rounded-full w-20 flex-shrink-0" />
            </div>

            {/* Time section skeleton */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="h-4 bg-slate-200 rounded w-40" />
            </div>

            {/* Footer skeleton */}
            <div className="h-3 bg-slate-100 rounded w-28" />
          </div>
        </div>
      ))}
    </div>
  );
};

/* Roaster Card Component */
interface RoasterCardProps {
  id: number;
  userName: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isLeave: boolean;
  isWeekOff: boolean;
}

const RoasterCard: React.FC<RoasterCardProps> = ({
  id,
  userName,
  date,
  startTime,
  endTime,
  isLeave,
  isWeekOff,
}) => {
  const getStatusBadge = () => {
    if (isWeekOff) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-slate-100 to-slate-50 border border-slate-200 rounded-full">
          <Calendar className="w-4 h-4 text-slate-600" />
          <span className="text-xs font-medium text-slate-700">Rest Day</span>
        </div>
      );
    }
    if (isLeave) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-full">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-medium text-amber-700">Leave</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-full">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <span className="text-xs font-medium text-emerald-700">Scheduled</span>
      </div>
    );
  };

  const getTimeDisplay = () => {
    if (isWeekOff || isLeave) {
      return <span className="text-sm text-slate-500">Not Applicable</span>;
    }
    if (startTime && endTime) {
      return (
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium text-slate-800">
            {startTime} - {endTime}
          </span>
        </div>
      );
    }
    return <span className="text-sm text-slate-400">No time set</span>;
  };

  const backgroundClass = isWeekOff
    ? 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 opacity-75'
    : 'bg-gradient-to-br from-white to-slate-50 border-slate-200 hover:border-indigo-300 hover:shadow-lg';

  return (
    <div
      className={`relative rounded-2xl border backdrop-blur-sm transition-all duration-300 overflow-hidden ${backgroundClass}`}
    >
      {/* Striped pattern for week off */}
      {isWeekOff && (
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div
            className="absolute inset-0 bg-gradient-to-r from-slate-300 to-transparent"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(51,65,85,0.1) 10px, rgba(51,65,85,0.1) 20px)',
            }}
          />
        </div>
      )}

      <div className="relative p-4 sm:p-5 md:p-6">
        {/* Header with name and status */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center shadow-md">
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                {userName}
              </h3>
              <p className="text-xs text-slate-500">ID: {id}</p>
            </div>
          </div>
          {getStatusBadge()}
        </div>

        {/* Time section */}
        <div className="flex items-center justify-between mb-4 p-3 bg-slate-50/60 rounded-xl border border-slate-100">
          <div className="flex-1">
            {getTimeDisplay()}
          </div>
          {!isWeekOff && !isLeave && (
            <div className="w-5 h-5 text-amber-500 ml-3 flex-shrink-0 flex items-center justify-center">⚡</div>
          )}
        </div>

        {/* Date footer */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>{new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
    </div>
  );
};

/* Main Display Component */
export const RoasterDisplay: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [roasterData, setRoasterData] = useState<RoasterData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        userName: `Staff ${record.user_id}`,
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
        <div className="space-y-4">
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
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-20 sm:pb-6">
      {/* Header Section */}
      <div className="space-y-4">
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
            { label: 'Total', value: stats.total, color: 'indigo', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200', textColor: 'text-indigo-700' },
            { label: 'Scheduled', value: stats.scheduled, color: 'emerald', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', textColor: 'text-emerald-700' },
            { label: 'On Leave', value: stats.onLeave, color: 'amber', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', textColor: 'text-amber-700' },
            { label: 'Week Off', value: stats.weekOff, color: 'slate', bgColor: 'bg-slate-50', borderColor: 'border-slate-200', textColor: 'text-slate-700' },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`p-3 rounded-xl border ${stat.borderColor} ${stat.bgColor} backdrop-blur-sm`}
            >
              <p className={`text-xs font-medium ${stat.textColor} uppercase tracking-wider`}>
                {stat.label}
              </p>
              <p className={`text-2xl font-bold ${stat.textColor} mt-1`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
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
        </div>
      )}

      {/* Loading state */}
      {loading && <RoasterSkeleton count={6} />}

      {/* Roaster cards grid */}
      {!loading && roasterData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
        </div>
      )}

      {/* Floating Action Button for mobile */}
      <button
        onClick={() => navigate('/roaster-management')}
        className="fixed bottom-6 right-6 sm:hidden z-40 w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-2xl flex items-center justify-center hover:shadow-3xl transition-all"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
};

export default RoasterDisplay;
