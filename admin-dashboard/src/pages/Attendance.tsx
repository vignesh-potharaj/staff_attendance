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
  check_out_photo_url?: string | null;
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-4">
        <div className="space-y-4">
          {records.map((record) => (
            <div 
              key={record.id}
              className="relative rounded-xl border border-indigo-100 bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-300 overflow-hidden p-4 sm:p-5"
            >
              {/* Timeline top border */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-400 to-blue-600" />

              {/* Card content - vertical layout */}
              <div className="space-y-4">
                {/* Header: Employee Info + Date */}
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      {record.user?.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ID: {record.user?.employee_id} • {record.date}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <span className={`px-3 py-1.5 inline-flex text-xs leading-5 font-semibold rounded-full flex-shrink-0 ${
                    record.status === 'PRESENT'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {record.status}
                  </span>
                </div>

                {/* Check-in & Check-out Times */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Check In</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">
                      {new Date(record.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                    <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Check Out</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">
                      {record.check_out_time 
                        ? new Date(record.check_out_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                        : 'Pending'}
                    </p>
                  </div>
                </div>

                {/* Selfies & Location Section */}
                <div className="border-t border-slate-200 pt-3 space-y-3">
                  {/* Selfies Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Check-In Selfie */}
                    <div>
                      <p className="text-xs text-green-600 font-medium mb-2 uppercase tracking-wide">📸 Check-In Selfie</p>
                      {record.photo_url ? (
                        <a 
                          href={`${API_BASE}${record.photo_url}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="block w-full rounded-lg overflow-hidden border border-green-200 hover:border-green-500 hover:shadow-md transition-all"
                        >
                          <img 
                            src={`${API_BASE}${record.photo_url}`}
                            alt="Check-in selfie"
                            className="w-full h-48 object-cover"
                          />
                        </a>
                      ) : (
                        <div className="w-full h-48 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                          <div className="text-center">
                            <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                            <p className="text-xs text-gray-400">No image</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Check-Out Selfie */}
                    <div>
                      <p className="text-xs text-red-600 font-medium mb-2 uppercase tracking-wide">📸 Check-Out Selfie</p>
                      {record.check_out_photo_url ? (
                        <a 
                          href={`${API_BASE}${record.check_out_photo_url}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="block w-full rounded-lg overflow-hidden border border-red-200 hover:border-red-500 hover:shadow-md transition-all"
                        >
                          <img 
                            src={`${API_BASE}${record.check_out_photo_url}`}
                            alt="Check-out selfie"
                            className="w-full h-48 object-cover"
                          />
                        </a>
                      ) : (
                        <div className="w-full h-48 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                          <div className="text-center">
                            <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                            <p className="text-xs text-gray-400">Not checked out</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <p className="text-xs text-gray-600 font-medium mb-2 uppercase tracking-wide">📍 Location</p>
                    <a 
                      href={`https://maps.google.com/?q=${record.latitude},${record.longitude}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="w-full rounded-lg border border-blue-200 hover:border-blue-500 p-4 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 hover:shadow-md transition-all"
                    >
                      <div className="text-center">
                        <MapPin className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                        <p className="text-xs font-medium text-blue-600">View Location</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {record.latitude.toFixed(4)}, {record.longitude.toFixed(4)}
                        </p>
                      </div>
                    </a>
                  </div>
                </div>

                {/* Device Info */}
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium">Device: <span className="text-gray-700">{record.device_info}</span></p>
                </div>
              </div>
            </div>
          ))}
          
          {records.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No attendance records found for this criteria.</p>
            </div>
          )}

          {loading && (
            <div className="text-center py-8 text-gray-500">
              <p>Loading records...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Attendance;
