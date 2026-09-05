import React, { useEffect, useState } from 'react';
import { Download, Search, FileSpreadsheet, MapPin, Image as ImageIcon } from 'lucide-react';
import api from '../services/api';
import { resolvePhotoUrl } from '../utils/urlHelper';

interface AttendanceRecord {
  id: number;
  user?: {
    name: string;
    employee_id: string;
  };
  date: string;
  check_in_time: string;
  expected_fall_in_time?: string | null;
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
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
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

  // Option 1: Daily / Filtered raw log CSV export
  const handleExportDaily = async () => {
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
      link.setAttribute('download', `attendance_daily_${dateFilter || 'all'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to export daily records');
    }
  };

  // Option 2: Monthly Summary CSV export
  const handleExportMonthly = async () => {
    try {
      const params = new URLSearchParams();
      if (monthFilter) params.append('month', monthFilter);
      if (empIdFilter) params.append('employee_id', empIdFilter);

      const response = await api.get(`/attendance/export/monthly?${params.toString()}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_monthly_${monthFilter || 'all'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to export monthly summary');
    }
  };

  // Option 3: Total Attendance Summary CSV export
  const handleExportTotal = async () => {
    try {
      const params = new URLSearchParams();
      if (empIdFilter) params.append('employee_id', empIdFilter);

      const response = await api.get(`/attendance/export/total?${params.toString()}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'attendance_total_summary.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to export total attendance summary');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-[#2D3092] uppercase tracking-tight">Cadet Attendance Monitoring</h2>
        <p className="text-xs text-slate-500 font-medium">Verify selfie logs, timestamps, and GPS session coordinates</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 border-t-4 border-t-[#2D3092] space-y-5">
        
        {/* Row 1: Daily Log Filter & Option 1 Export Button */}
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end pb-4 border-b border-slate-100">
          <div>
            <label className="block text-xs font-bold text-[#2D3092] uppercase tracking-wider mb-1">Filter by Date</label>
            <input 
              type="date" 
              className="block w-full border border-slate-300 rounded-xl py-2 px-3 focus:ring-2 focus:ring-[#2D3092] text-sm font-semibold text-slate-900"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
            />
          </div>

          {/* Option 1 Button: Placed beside Filter by Date column */}
          <button 
            type="button"
            onClick={handleExportDaily}
            className="bg-[#EF1C25] hover:bg-[#C7131B] text-white px-5 py-2.5 rounded-xl font-bold flex items-center space-x-2 shadow-md border-b-2 border-[#FFCB06] transition-all text-sm shrink-0"
          >
            <Download className="w-4 h-4 text-[#FFCB06]" />
            <span>Export Attendance CSV</span>
          </button>

          <div className="sm:ml-auto flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-bold text-[#2D3092] uppercase tracking-wider mb-1">Cadet Regt / User ID</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search ID..."
                  className="block w-full border border-slate-300 rounded-xl py-2 pl-9 pr-3 focus:ring-2 focus:ring-[#2D3092] text-sm font-semibold text-slate-900"
                  value={empIdFilter}
                  onChange={e => setEmpIdFilter(e.target.value)}
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>
            <button type="submit" className="bg-[#2D3092] hover:bg-[#3F43B5] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all">
              Apply Filters
            </button>
          </div>
        </form>

        {/* Row 2: Attendance Summary Export Options (Option 2 & Option 3) */}
        <div>
          <p className="text-xs font-black text-[#2D3092] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-[#00AEEF]" />
            <span>Summary Export Reports</span>
          </p>
          <div className="flex flex-wrap gap-4 items-center">
            
            {/* Option 2: Export by Month */}
            <div className="flex flex-wrap items-end gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 flex-1 min-w-[280px]">
              <div className="flex-1 min-w-[130px]">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Month (Option 2)</label>
                <input 
                  type="month" 
                  className="block w-full border border-slate-300 rounded-lg py-1.5 px-3 focus:ring-2 focus:ring-[#2D3092] text-xs font-semibold bg-white text-slate-900"
                  value={monthFilter}
                  onChange={e => setMonthFilter(e.target.value)}
                />
              </div>
              <button 
                type="button"
                onClick={handleExportMonthly}
                className="bg-[#2D3092] hover:bg-[#3F43B5] text-white px-4 py-2 rounded-lg font-bold flex items-center space-x-2 shadow-sm border-b-2 border-[#FFCB06] transition-all text-xs shrink-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#FFCB06]" />
                <span>Export Monthly Summary</span>
              </button>
            </div>

            {/* Option 3: Export Total Attendance */}
            <div className="flex items-center bg-slate-50 p-3 rounded-xl border border-slate-200 flex-1 min-w-[260px] justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">All-Time Report (Option 3)</p>
                <p className="text-[10px] text-slate-500 font-medium">Cadet totals & attendance %</p>
              </div>
              <button 
                type="button"
                onClick={handleExportTotal}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold flex items-center space-x-2 shadow-sm border-b-2 border-emerald-400 transition-all text-xs shrink-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                <span>Export Total Attendance</span>
              </button>
            </div>

          </div>
        </div>

      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-4">
        <div className="space-y-4">
          {records.map((record) => (
            <div 
              key={record.id}
              className="relative rounded-2xl border border-slate-200 bg-white hover:border-[#00AEEF] hover:shadow-md transition-all duration-300 overflow-hidden p-4 sm:p-5"
            >
              {/* NCC Tri-Color Top Accent Line */}
              <div className="ncc-tricolor-bar absolute top-0 left-0 right-0">
                <div className="stripe-red" />
                <div className="stripe-navy" />
                <div className="stripe-skyblue" />
              </div>

              {/* Card content - vertical layout */}
              <div className="space-y-4 pt-2">
                {/* Header: Employee Info + Date */}
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-black text-[#2D3092]">
                      {record.user?.name}
                    </h3>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">
                      Cadet ID: <span className="text-[#EF1C25] font-black">{record.user?.employee_id}</span> • Date: {record.date}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <span className={`px-3.5 py-1 inline-flex text-xs leading-5 font-black rounded-full flex-shrink-0 border ${
                    record.status === 'PRESENT'
                      ? 'bg-[#00AEEF]/10 text-[#00AEEF] border-[#00AEEF]/40'
                      : 'bg-[#FFCB06]/20 text-[#D9AB00] border-[#FFCB06]'
                  }`}>
                    {record.status}
                  </span>
                </div>

                {/* Fall-In & Visarjan Times */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#00AEEF]/10 p-3 rounded-xl border border-[#00AEEF]/30">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <p className="text-xs text-[#00AEEF] font-bold uppercase tracking-wider">Fall-In Time</p>
                      {record.expected_fall_in_time && (
                        <span className="text-[10px] font-bold bg-[#2D3092] text-white px-2 py-0.5 rounded-full shadow-sm">
                          Expected: {record.expected_fall_in_time}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-black text-slate-900 mt-1">
                      {new Date(record.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                  <div className="bg-[#EF1C25]/10 p-3 rounded-xl border border-[#EF1C25]/30">
                    <p className="text-xs text-[#EF1C25] font-bold uppercase tracking-wider">Visarjan Time</p>
                    <p className="text-sm font-black text-slate-900 mt-1">
                      {record.check_out_time 
                        ? new Date(record.check_out_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                        : 'Pending'}
                    </p>
                  </div>
                </div>

                {/* Selfies & Location Section */}
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  {/* Selfies Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Fall-In Selfie */}
                    <div>
                      <p className="text-xs text-green-600 font-medium mb-2 uppercase tracking-wide">📸 Fall-In Selfie</p>
                      {record.photo_url ? (
                        <a 
                          href={resolvePhotoUrl(record.photo_url) || '#'} 
                          target="_blank" 
                          rel="noreferrer"
                          className="block w-full rounded-lg overflow-hidden border border-green-200 hover:border-green-500 hover:shadow-md transition-all"
                        >
                          <img 
                            src={resolvePhotoUrl(record.photo_url) || ''}
                            alt="Fall-in selfie"
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

                    {/* Visarjan Selfie */}
                    <div>
                      <p className="text-xs text-red-600 font-medium mb-2 uppercase tracking-wide">📸 Visarjan Selfie</p>
                      {record.check_out_photo_url ? (
                        <a 
                          href={resolvePhotoUrl(record.check_out_photo_url) || '#'} 
                          target="_blank" 
                          rel="noreferrer"
                          className="block w-full rounded-lg overflow-hidden border border-red-200 hover:border-red-500 hover:shadow-md transition-all"
                        >
                          <img 
                            src={resolvePhotoUrl(record.check_out_photo_url) || ''}
                            alt="Visarjan selfie"
                            className="w-full h-48 object-cover"
                          />
                        </a>
                      ) : (
                        <div className="w-full h-48 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                          <div className="text-center">
                            <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                            <p className="text-xs text-gray-400">Pending Visarjan</p>
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
