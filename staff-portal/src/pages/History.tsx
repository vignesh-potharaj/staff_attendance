import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Search } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface AttendanceRecord {
  id: number;
  date: string;
  status: string;
  check_in_time: string;
  check_out_time?: string | null;
  duration_hours: number;
}

const formatTime = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const displayStatus = (record: AttendanceRecord) => {
  if (!record.check_out_time) return 'Pending';
  if (record.status === 'PRESENT' || record.status === 'LATE') return 'Present';
  return record.status;
};

const History: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.get(`/api/attendance/staff/${user.id}`);
        setRecords(response.data);
      } catch {
        console.error('Failed to fetch history');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user?.id]);

  const visibleRecords = useMemo(() => {
    if (!monthFilter) return records;
    return records.filter((record) => record.date.startsWith(monthFilter));
  }, [monthFilter, records]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-600">Attendance History</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">Your Records</h1>
        </div>
        <label className="block sm:w-56">
          <span className="block text-sm font-medium text-slate-700 mb-1">Month</span>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="block w-full border border-slate-300 rounded-lg py-2 px-3 bg-white"
          />
        </label>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Loading history...</p>
        </div>
      ) : visibleRecords.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No records found</h3>
          <p className="text-gray-500">Try another month or mark attendance first.</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Check-in</th>
                  <th className="text-left px-4 py-3">Check-out</th>
                  <th className="text-left px-4 py-3">Duration</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-semibold text-slate-900">{record.date}</td>
                    <td className="px-4 py-4 text-slate-600">{formatTime(record.check_in_time)}</td>
                    <td className="px-4 py-4 text-slate-600">{formatTime(record.check_out_time)}</td>
                    <td className="px-4 py-4 text-slate-600">{record.duration_hours.toFixed(2)} hrs</td>
                    <td className="px-4 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        displayStatus(record) === 'Pending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {displayStatus(record)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {visibleRecords.map((record) => (
              <div key={record.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    {record.date}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    displayStatus(record) === 'Pending'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {displayStatus(record)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 font-semibold">Check-in</p>
                    <p className="font-bold text-slate-900 mt-1">{formatTime(record.check_in_time)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 font-semibold">Check-out</p>
                    <p className="font-bold text-slate-900 mt-1">{formatTime(record.check_out_time)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <Clock className="w-4 h-4 text-blue-600" />
                  {record.duration_hours.toFixed(2)} hours worked
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default History;
