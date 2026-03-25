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

const TodayRoaster: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedules, setSchedules] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [uRes, sRes] = await Promise.all([
        api.get('/users/'),
        api.get('/shifts/')
      ]);
      
      const staffOnly = uRes.data.filter((u: User) => u.role === 'STAFF');
      setUsers(staffOnly);
      setShifts(sRes.data);

      // Initialize schedules with default shifts from user profiles
      const initialSchedules: Record<number, string> = {};
      staffOnly.forEach((u: User) => {
        initialSchedules[u.id] = u.shift?.id.toString() || '';
      });
      setSchedules(initialSchedules);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleShiftChange = (userId: number, value: string) => {
    setSchedules(prev => ({ ...prev, [userId]: value }));
  };

  const generateWhatsAppMessage = () => {
    const today = new Date().toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });

    let message = `📅 *Staff Duty Roaster - ${today}*\n`;
    message += `------------------------------------------\n\n`;

    users.forEach((user, index) => {
      const selectedValue = schedules[user.id];
      let statusText = '';

      if (selectedValue === 'leave') {
        statusText = '🔴 *ON LEAVE*';
      } else if (selectedValue) {
        const shift = shifts.find(s => s.id.toString() === selectedValue);
        if (shift) {
          statusText = `🔵 ${shift.shift_name} (${shift.start_time.substring(0, 5)} - ${shift.end_time.substring(0, 5)})`;
        } else {
          statusText = '⚪ Not Assigned';
        }
      } else {
        statusText = '⚪ Not Assigned';
      }

      message += `${index + 1}. *${user.name}*: ${statusText}\n`;
    });

    message += `\n------------------------------------------\n`;
    message += `_Please be on time. Have a great day!_`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CalendarIcon className="text-blue-600" />
            Today's Roaster
          </h2>
          <p className="text-gray-500 mt-1">Assign shifts and share the daily schedule</p>
        </div>
        <button
          onClick={generateWhatsAppMessage}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg flex items-center space-x-2 shadow-md transition-shadow"
        >
          <Share2 className="w-5 h-5" />
          <span>Share on WhatsApp</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff member</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned Shift</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => {
              const selectedValue = schedules[user.id];
              const isLeave = selectedValue === 'leave';
              
              return (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
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
                    <select
                      value={selectedValue}
                      onChange={(e) => handleShiftChange(user.id, e.target.value)}
                      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border ${
                        isLeave ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white'
                      }`}
                    >
                      <option value="">Select Shift...</option>
                      {shifts.map((shift) => (
                        <option key={shift.id} value={shift.id.toString()}>
                          {shift.shift_name} ({shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)})
                        </option>
                      ))}
                      <option value="leave" className="text-red-600 font-semibold">📍 ON LEAVE</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isLeave ? (
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-red-100 text-red-800 items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        LEAVE
                      </span>
                    ) : selectedValue ? (
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-green-100 text-green-800 items-center gap-1">
                         <Clock className="w-3 h-3" />
                         SCHEDULED
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
        {users.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            No staff members found.
          </div>
        )}
      </div>
    </div>
  );
};

export default TodayRoaster;
