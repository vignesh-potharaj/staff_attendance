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
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch roaster data';
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff member</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Timing & Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Summary</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => {
                const schedule = schedules[user.id];
                
                return (
                  <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${schedule?.isLeave ? 'bg-red-50/30' : schedule?.isWeekOff ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                          <UserIcon className="w-5 h-5" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-500">ID: {user.employee_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={schedule?.isLeave || false}
                            onChange={(e) => handleToggle(user.id, 'isLeave', e.target.checked)}
                            className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                          />
                          <span className="ml-2 text-sm font-medium text-gray-700">Leave</span>
                        </label>

                        <label className="flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={schedule?.isWeekOff || false}
                            onChange={(e) => handleToggle(user.id, 'isWeekOff', e.target.checked)}
                            className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500 cursor-pointer"
                          />
                          <span className="ml-2 text-sm font-medium text-gray-700">Week Off</span>
                        </label>
                        
                        {(!schedule?.isLeave && !schedule?.isWeekOff) && (
                          <div className="flex items-center space-x-2 bg-gray-50 p-1.5 rounded-md border border-gray-200">
                            <input 
                              type="time" 
                              title="Start Time"
                              value={schedule?.startTime || ''}
                              onChange={(e) => handleTimeChange(user.id, 'startTime', e.target.value)}
                              className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-1.5 border bg-white"
                            />
                            <span className="text-gray-500 text-sm font-medium px-1">to</span>
                            <input 
                              type="time" 
                              title="End Time"
                              value={schedule?.endTime || ''}
                              onChange={(e) => handleTimeChange(user.id, 'endTime', e.target.value)}
                              className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-1.5 border bg-white"
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {schedule?.isLeave ? (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-red-100 text-red-800 items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                          LEAVE
                        </span>
                      ) : schedule?.isWeekOff ? (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-amber-100 text-amber-800 items-center gap-1">
                          WEEK OFF
                        </span>
                      ) : (schedule?.startTime && schedule?.endTime) ? (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-green-100 text-green-800 items-center gap-1">
                           <Clock className="w-3 h-3" />
                           {formatTime12h(schedule.startTime)} - {formatTime12h(schedule.endTime)}
                        </span>
                      ) : (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-medium rounded-full bg-gray-100 text-gray-800">
                          PENDING
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
