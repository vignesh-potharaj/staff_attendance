import React, { useEffect, useState } from 'react';
import { Download, Search, MapPin, Image as ImageIcon } from 'lucide-react';
import api from '../services/api';

interface AttendanceRecord {
  id: number;
  user?: {
    name: string;
    employee_id: string;
  };
  date: string;
  check_in_time: string;
  check_out_time?: string | null;
  status: string;
  latitude: number;
  longitude: number;
  photo_url: string;
  device_info: string;
}

const Attendance: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [empIdFilter, setEmpIdFilter] = useState('');

  const fetchRecords = React.useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.append('date', dateFilter);
      if (empIdFilter) params.append('employee_id', empIdFilter);

      const res = await api.get(`/attendance/records?${params.toString()}`);
      setRecords(res.data);
    } catch {
      console.error("Failed to fetch records");
    } finally {
      setLoading(false);
    }
  }, [dateFilter, empIdFilter]);

  // Re-fetch when date changes
  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecords();
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.append('date', dateFilter);
      if (empIdFilter) params.append('employee_id', empIdFilter);

      const response = await api.get(`/attendance/export?${params.toString()}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_${dateFilter || 'all'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to export records');
    }
  };

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold text-gray-800">Attendance Monitoring</h2>
        <button 
          onClick={handleExport}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Date</label>
            <input 
              type="date" 
              className="block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500 text-sm"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search ID..."
                className="block w-full border border-gray-300 rounded-md py-2 pl-9 pr-3 focus:ring-blue-500 focus:border-blue-500 text-sm"
                value={empIdFilter}
                onChange={e => setEmpIdFilter(e.target.value)}
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium h-10">
            Apply Filters
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Selfie</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                   <div className="text-sm font-medium text-gray-900">{record.user?.name}</div>
                   <div className="text-sm text-gray-500">ID: {record.user?.employee_id}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{record.date}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    <span className="font-medium text-green-600">In:</span> {new Date(record.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                  <div className="text-sm text-gray-500">
                    <span className="font-medium text-red-600">Out:</span> {record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Pending'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    record.status === 'PRESENT' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {record.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <a 
                    href={`https://maps.google.com/?q=${record.latitude},${record.longitude}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                  >
                    <MapPin className="w-4 h-4 mr-1" />
                    View Map
                  </a>
                  <div className="text-xs text-gray-400 mt-1 truncate w-32" title={record.device_info}>
                    {record.device_info}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {record.photo_url ? (
                    <a href={`${API_BASE}${record.photo_url}`} target="_blank" rel="noreferrer" className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 hover:bg-gray-200 transition">
                      <ImageIcon className="w-5 h-5 text-gray-500" />
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400">N/A</span>
                  )}
                </td>
              </tr>
            ))}
            {records.length === 0 && !loading && (
               <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No attendance records found for this criteria.</td></tr>
            )}
            {loading && (
               <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">Loading records...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Attendance;
