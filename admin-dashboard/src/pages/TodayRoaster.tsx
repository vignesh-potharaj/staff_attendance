import React, { useEffect, useState } from 'react';
import { Share2, Calendar as CalendarIcon, User as UserIcon, Clock } from 'lucide-react';
import api from '../services/api';

interface Shift {
  id: number;
  shift_name: string;
  start_time: string;
  end_time: string;
}

interface User {
  id: number;
  name: string;
  employee_id: string;
  role: string;
  shift?: Shift;
}

interface ScheduleInput {
  isLeave: boolean;
  isWeekOff: boolean;
  startTime: string;
  endTime: string;
}

const TodayRoaster: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [schedules, setSchedules] = useState<Record<number, ScheduleInput>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // History State
  const [historyDate, setHistoryDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchData = async () => {
    try {
      setError(null);
      const todayDate = new Date().toLocaleDateString('en-CA');
      
      // Debug: Check if token exists
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      
      const [uRes, rRes] = await Promise.all([
        api.get('/users/'),
        api.get(`/roaster/?date=${todayDate}`)
      ]);
      
      const staffOnly = uRes.data.filter((u: User) => u.role === 'STAFF');
      setUsers(staffOnly);

      const existingRoasters = rRes.data || [];
      const roasterMap: Record<number, any> = {};
      existingRoasters.forEach((r: any) => {
        roasterMap[r.user_id] = r;
      });

      const initialSchedules: Record<number, ScheduleInput> = {};
      staffOnly.forEach((u: User) => {
        if (roasterMap[u.id]) {
          const r = roasterMap[u.id];
          initialSchedules[u.id] = {
             isLeave: !!r.is_leave,
             isWeekOff: !!r.is_week_off,
             startTime: r.start_time ? r.start_time.substring(0, 5) : '',
             endTime: r.end_time ? r.end_time.substring(0, 5) : ''
          };
        } else {
          initialSchedules[u.id] = {
             isLeave: false,
             isWeekOff: false,
             startTime: '10:00',
             endTime: '18:30'
          };
        }
      });
      setSchedules(initialSchedules);
    } catch (err: unknown) {
      let errorMsg = 'Failed to fetch roaster data';
      if (err instanceof Error) {
        errorMsg = err.message;
      } else if (typeof err === 'object' && err !== null && 'response' in err) {
        const axiosErr = err as any;
        if (axiosErr.response?.status === 401) {
          errorMsg = 'Authentication failed. Please log in again.';
        } else if (axiosErr.response?.status === 403) {
          errorMsg = 'You do not have permission to access this resource.';
        } else if (axiosErr.response?.data?.detail) {
          errorMsg = axiosErr.response.data.detail;
        }
      }
      setError(errorMsg);
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (date: string) => {
    setHistoryLoading(true);
    try {
      const res = await api.get(`/roaster/?date=${date}`);
      setHistoryRecords(res.data || []);
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchHistory(historyDate);
  }, []);

  const handleTimeChange = (userId: number, field: 'startTime' | 'endTime', value: string) => {
    setSchedules(prev => ({ 
      ...prev, 
      [userId]: { ...prev[userId], [field]: value } 
    }));
  };

  const handleToggle = (userId: number, field: 'isLeave' | 'isWeekOff', value: boolean) => {
    setSchedules(prev => {
      const updated = { ...prev[userId], [field]: value };
      // If one is enabled, ensure the other is disabled
      if (value) {
        if (field === 'isLeave') updated.isWeekOff = false;
        if (field === 'isWeekOff') updated.isLeave = false;
      }
      return { ...prev, [userId]: updated };
    });
  };

  const formatTime12h = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${m} ${ampm}`;
  };

  const handleSaveAndShare = async () => {
    try {
      const todayDate = new Date().toLocaleDateString('en-CA');
      
      const payload = users.map(u => ({
        user_id: u.id,
        date: todayDate,
        start_time: (schedules[u.id]?.isLeave || schedules[u.id]?.isWeekOff) ? null : (schedules[u.id]?.startTime ? schedules[u.id].startTime + ':00' : null),
        end_time: (schedules[u.id]?.isLeave || schedules[u.id]?.isWeekOff) ? null : (schedules[u.id]?.endTime ? schedules[u.id].endTime + ':00' : null),
        is_leave: schedules[u.id]?.isLeave || false,
        is_week_off: schedules[u.id]?.isWeekOff || false
      }));

      await api.post(`/roaster/bulk?date=${todayDate}`, payload);
      fetchHistory(todayDate); // Refresh history if viewing today
      
      const todayFormatted = new Date().toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });

      let message = `📅 *Staff Duty Roaster - ${todayFormatted}*\n`;
      message += `------------------------------------------\n\n`;

      users.forEach((user, index) => {
        const schedule = schedules[user.id];
        let statusText = '';

        if (schedule && schedule.isLeave) {
          statusText = '🔴 *ON LEAVE*';
        } else if (schedule && schedule.isWeekOff) {
          statusText = '🟡 *WEEK OFF*';
        } else if (schedule && schedule.startTime && schedule.endTime) {
          statusText = `🔵 ${formatTime12h(schedule.startTime)} - ${formatTime12h(schedule.endTime)}`;
        } else {
          statusText = '⚪ Not Assigned';
        }

        message += `${index + 1}. *${user.name}*: ${statusText}\n`;
      });

      message += `\n------------------------------------------\n`;
      message += `_Please be on time. Have a great day!_`;

      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    } catch (err) {
      console.error('Failed to save roaster', err);
      alert('Failed to save roaster. Please ensure backend is running.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-800">
          <h3 className="font-semibold text-lg mb-2">Error Loading Roaster</h3>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchData();
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <section>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <CalendarIcon className="text-blue-600" />
              Today's Roaster
            </h2>
            <p className="text-gray-500 mt-1">Assign custom shift timings and share the schedule</p>
          </div>
          <button
            onClick={handleSaveAndShare}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg flex items-center space-x-2 shadow-md transition-shadow"
          >
            <Share2 className="w-5 h-5" />
            <span>Save & Share on WhatsApp</span>
          </button>
        </div>

        <div className="space-y-3">
          {users.map((user) => {
            const schedule = schedules[user.id];
            
            return (
              <div 
                key={user.id}
                className={`relative rounded-xl border backdrop-blur-sm transition-all duration-300 overflow-hidden p-4 sm:p-5 ${
                  schedule?.isWeekOff
                    ? 'bg-slate-50 border-slate-200'
                    : schedule?.isLeave
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-white border-indigo-100 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                {/* Timeline top border */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
                  schedule?.isWeekOff
                    ? 'from-slate-300 to-slate-400'
                    : schedule?.isLeave
                    ? 'from-amber-400 to-orange-500'
                    : 'from-indigo-400 to-blue-600'
                }`} />

                {/* Card content - vertical layout */}
                <div className="space-y-3">
                  {/* Header: Avatar + Name + ID */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center shadow-md">
                      <UserIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        {user.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ID: {user.employee_id}
                      </p>
                    </div>
                  </div>

                  {/* Time Display */}
                  <div className="bg-white/60 backdrop-blur rounded-lg p-3 border border-white/80">
                    <p className="text-xs text-slate-600 font-medium mb-1 uppercase tracking-wide">Shift Time</p>
                    <p className="text-lg sm:text-xl font-bold text-slate-900">
                      {schedule?.isLeave || schedule?.isWeekOff 
                        ? '—' 
                        : schedule?.startTime && schedule?.endTime 
                        ? `${schedule.startTime} → ${schedule.endTime}` 
                        : 'Not set'}
                    </p>
                  </div>

                  {/* Controls: Time Inputs + Checkboxes */}
                  <div className="space-y-2">
                    {(!schedule?.isLeave && !schedule?.isWeekOff) && (
                      <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <span className="text-xs font-medium text-gray-600 min-w-fit">Time:</span>
                        <input 
                          type="time" 
                          title="Start Time"
                          value={schedule?.startTime || ''}
                          onChange={(e) => handleTimeChange(user.id, 'startTime', e.target.value)}
                          className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-1.5 border bg-white flex-1"
                        />
                        <span className="text-gray-400 text-xs px-1">to</span>
                        <input 
                          type="time" 
                          title="End Time"
                          value={schedule?.endTime || ''}
                          onChange={(e) => handleTimeChange(user.id, 'endTime', e.target.value)}
                          className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-1.5 border bg-white flex-1"
                        />
                      </div>
                    )}

                    {/* Leave and Off checkboxes */}
                    <div className="flex items-center gap-4">
                      <label className="flex items-center cursor-pointer gap-2">
                        <input 
                          type="checkbox" 
                          checked={schedule?.isLeave || false}
                          onChange={(e) => handleToggle(user.id, 'isLeave', e.target.checked)}
                          className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                        />
                        <span className="text-sm font-medium text-gray-700">Leave</span>
                      </label>

                      <label className="flex items-center cursor-pointer gap-2">
                        <input 
                          type="checkbox" 
                          checked={schedule?.isWeekOff || false}
                          onChange={(e) => handleToggle(user.id, 'isWeekOff', e.target.checked)}
                          className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500 cursor-pointer"
                        />
                        <span className="text-sm font-medium text-gray-700">Off</span>
                      </label>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex justify-end pt-2 border-t border-slate-200">
                    {schedule?.isLeave ? (
                      <span className="px-3 py-1.5 inline-flex text-xs leading-5 font-bold rounded-lg bg-red-100 text-red-800 items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        Leave
                      </span>
                    ) : schedule?.isWeekOff ? (
                      <span className="px-3 py-1.5 inline-flex text-xs leading-5 font-bold rounded-lg bg-amber-100 text-amber-800">
                        Week Off
                      </span>
                    ) : (schedule?.startTime && schedule?.endTime) ? (
                      <span className="px-3 py-1.5 inline-flex text-xs leading-5 font-bold rounded-lg bg-green-100 text-green-800 items-center gap-1">
                         <Clock className="w-3 h-3" />
                         On Duty
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 inline-flex text-xs leading-5 font-medium rounded-lg bg-gray-100 text-gray-800">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Roaster History Section */}
      <section className="pt-8 border-t border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Clock className="text-purple-600" />
              Roaster History
            </h2>
            <p className="text-gray-500 mt-1">View schedules for any past date</p>
          </div>
          <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
            <span className="text-sm font-medium text-gray-700 px-2">Select Date:</span>
            <input 
              type="date" 
              value={historyDate}
              onChange={(e) => {
                setHistoryDate(e.target.value);
                fetchHistory(e.target.value);
              }}
              className="border-0 focus:ring-0 text-sm font-semibold text-gray-900 bg-transparent"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Roaster Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {historyLoading ? (
                <tr>
                   <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                     <div className="flex flex-col items-center gap-2">
                       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                       <span>Loading history...</span>
                     </div>
                   </td>
                </tr>
              ) : historyRecords.length > 0 ? (
                historyRecords.map((r: any) => {
                  const user = users.find(u => u.id === r.user_id);
                  return (
                    <tr key={r.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user?.employee_id || r.user_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user?.name || 'Unknown Staff'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {r.is_leave ? (
                          <span className="text-red-600 font-bold text-xs bg-red-50 px-2.5 py-1 rounded-full border border-red-100">LEAVE</span>
                        ) : r.is_week_off ? (
                          <span className="text-amber-600 font-bold text-xs bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">WEEK OFF</span>
                        ) : (r.start_time && r.end_time) ? (
                          <span className="text-green-700 font-medium text-xs bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
                            {formatTime12h(r.start_time)} - {formatTime12h(r.end_time)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs italic">No assignment</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                   <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                     No roaster records found for this date.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default TodayRoaster;
