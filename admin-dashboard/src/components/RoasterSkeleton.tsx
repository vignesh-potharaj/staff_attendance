import React from 'react';
import { motion } from 'framer-motion';

export const RoasterSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.1 }}
          className="rounded-2xl border border-slate-200 backdrop-blur-sm bg-white/50 overflow-hidden"
        >
          <div className="p-4 sm:p-5 md:p-6 space-y-4">
            {/* Header skeleton */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded-lg w-32 animate-pulse" />
                  <div className="h-3 bg-slate-100 rounded w-24 animate-pulse" />
                </div>
              </div>
              <div className="h-6 bg-slate-200 rounded-full w-20 animate-pulse flex-shrink-0" />
            </div>

            {/* Time section skeleton */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="h-4 bg-slate-200 rounded w-40 animate-pulse" />
            </div>

            {/* Footer skeleton */}
            <div className="h-3 bg-slate-100 rounded w-28 animate-pulse" />
          </div>
        </motion.div>
      ))}
    </div>
  );
};
