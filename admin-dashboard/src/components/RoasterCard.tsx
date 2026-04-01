import React from 'react';
import { Clock, Calendar, User, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface RoasterCardProps {
  id: number;
  userName: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isLeave: boolean;
  isWeekOff: boolean;
}

export const RoasterCard: React.FC<RoasterCardProps> = ({
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className={`relative rounded-2xl border backdrop-blur-sm transition-all duration-300 overflow-hidden ${backgroundClass}`}
    >
      {/* Striped pattern for week off */}
      {isWeekOff && (
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-300 to-transparent" 
               style={{
                 backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(51,65,85,0.1) 10px, rgba(51,65,85,0.1) 20px)'
               }}>
          </div>
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
            <Zap className="w-5 h-5 text-amber-500 ml-3 flex-shrink-0" />
          )}
        </div>

        {/* Date footer */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>{new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
    </motion.div>
  );
};
