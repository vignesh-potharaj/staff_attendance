import React, { useEffect, useState, useRef } from 'react';
import { Download, Search, FileSpreadsheet, MapPin, Image as ImageIcon, Calendar, User as UserIcon, ChevronDown, X, Users } from 'lucide-react';
import api from '../services/api';
import { resolvePhotoUrl } from '../utils/urlHelper';

interface AttendanceRecord {
  id: number;
  user_id?: number;
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

interface CadetOption {
  id: number;
  name: string;
  employee_id: string;
  phone?: string;
  role?: string;
}

interface CadetSummary {
  month_present_days: number;
  overall_present_days: number;
  month_total_sessions?: number;
  overall_total_sessions?: number;
  month_attendance_pct?: number;
  overall_attendance_pct?: number;
  month_late_count?: number;
  overall_late_count?: number;
  month_absent_count?: number;
  overall_absent_count?: number;
}

const Attendance: React.FC = () => {
  // View mode: Timeline vs Individual
  const [viewMode, setViewMode] = useState<'timeline' | 'individual'>('timeline');

  // Timeline state
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [empIdFilter, setEmpIdFilter] = useState('');

  // Individual mode state
  const [cadetList, setCadetList] = useState<CadetOption[]>([]);
  const [loadingCadets, setLoadingCadets] = useState(false);
  const [selectedCadetId, setSelectedCadetId] = useState<number | null>(null);
  const [cadetSearchQuery, setCadetSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const [cadetRecords, setCadetRecords] = useState<AttendanceRecord[]>([]);
  const [cadetSummary, setCadetSummary] = useState<CadetSummary | null>(null);
  const [loadingIndividual, setLoadingIndividual] = useState(false);

  // Close combobox dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Fetch cadet list for individual view
  useEffect(() => {
    const fetchCadets = async () => {
      try {
        setLoadingCadets(true);
        const res = await api.get('/users/');
        const users: CadetOption[] = res.data || [];
        const sorted = users
          .filter(u => u.role === 'STAFF' || !u.role)
          .sort((a, b) => a.name.localeCompare(b.name));
        setCadetList(sorted);
      } catch (err) {
        console.error("Failed to load cadet list", err);
      } finally {
        setLoadingCadets(false);
      }
    };

    if (viewMode === 'individual' && cadetList.length === 0) {
      fetchCadets();
    }
  }, [viewMode, cadetList.length]);

  const handleSelectCadet = async (cadetId: number | null) => {
    setSelectedCadetId(cadetId);
    if (!cadetId) {
      setCadetRecords([]);
      setCadetSummary(null);
      return;
    }

    try {
      setLoadingIndividual(true);
      const [historyRes, summaryRes] = await Promise.all([
        api.get(`/attendance/staff/${cadetId}`),
        api.get(`/attendance/staff/${cadetId}/summary`)
      ]);
      setCadetRecords(historyRes.data || []);
      setCadetSummary(summaryRes.data || null);
    } catch (err) {
      console.error("Failed to fetch cadet attendance details", err);
      alert("Could not load attendance details for selected cadet");
    } finally {
      setLoadingIndividual(false);
    }
  };

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

  const selectedCadet = cadetList.find(c => c.id === selectedCadetId);

  const filteredCadets = cadetList.filter(c => {
    if (!cadetSearchQuery.trim()) return true;
    const q = cadetSearchQuery.toLowerCase().trim();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.employee_id && c.employee_id.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  });

  const handleExportIndividual = async () => {
    if (!selectedCadet || cadetRecords.length === 0) {
      alert('No attendance records to export for this cadet.');
      return;
    }

    try {
      const response = await api.get(`/attendance/staff/${selectedCadet.id}/export`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_${selectedCadet.employee_id}_all.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      const headers = [
        'Cadet Name',
        'Cadet Regt ID',
        'Date',
        'Expected Fall-In',
        'Fall-In Time',
        'Visarjan Time',
        'Status',
        'Latitude',
        'Longitude',
        'Device Info'
      ];

      const rows = cadetRecords.map(r => [
        `"${(selectedCadet.name || '').replace(/"/g, '""')}"`,
        `"${(selectedCadet.employee_id || '').replace(/"/g, '""')}"`,
        `"${r.date || ''}"`,
        `"${r.expected_fall_in_time || ''}"`,
        `"${r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}"`,
        `"${r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}"`,
        `"${r.status || ''}"`,
        r.latitude ?? '',
        r.longitude ?? '',
        `"${(r.device_info || '').replace(/"/g, '""')}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_${selectedCadet.employee_id}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  const renderAttendanceCard = (record: AttendanceRecord, cadetInfo?: { name: string; employee_id: string }) => {
    const cadetName = record.user?.name || cadetInfo?.name || 'Cadet';
    const regtId = record.user?.employee_id || cadetInfo?.employee_id || '—';

    return (
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
          {/* Header: Cadet Info + Date */}
          <div className="flex items-start gap-3 justify-between">
            <div className="flex-1">
              <h3 className="text-base sm:text-lg font-black text-[#2D3092]">
                {cadetName}
              </h3>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                Cadet ID: <span className="text-[#EF1C25] font-black">{regtId}</span> • Date: {record.date}
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
                {record.check_in_time 
                  ? new Date(record.check_in_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                  : '—'}
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
                    {typeof record.latitude === 'number' ? record.latitude.toFixed(4) : record.latitude}, {typeof record.longitude === 'number' ? record.longitude.toFixed(4) : record.longitude}
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
    );
  };

  return (
    <div className="space-y-6">
      {/* Title & View Switch (Timeline vs Individual) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#2D3092] uppercase tracking-tight">Cadet Attendance Monitoring</h2>
          <p className="text-xs text-slate-500 font-medium">
            {viewMode === 'timeline' 
              ? 'Verify session drill logs, timestamps, and GPS coordinates across all cadets' 
              : 'Detailed drill history, monthly statistics, and logs for individual cadets'}
          </p>
        </div>

        {/* Segmented Switch */}
        <div className="inline-flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner self-start sm:self-auto gap-1">
          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              viewMode === 'timeline'
                ? 'bg-[#2D3092] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Timeline</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('individual')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              viewMode === 'individual'
                ? 'bg-[#2D3092] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Individual</span>
          </button>
        </div>
      </div>

      {viewMode === 'timeline' ? (
        <>
          {/* Timeline Filters and Export Reports */}
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

          {/* Timeline Attendance Records */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-4">
            <div className="space-y-4">
              {records.map((record) => renderAttendanceCard(record))}
              
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
        </>
      ) : (
        <>
          {/* Individual Cadet View */}
          {/* Individual Cadet View Controls */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 border-t-4 border-t-[#2D3092]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Unified Cadet Search & Select Combobox */}
              <div className="flex-1 min-w-[280px] max-w-2xl relative" ref={comboboxRef}>
                <label className="block text-xs font-bold text-[#2D3092] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Cadet Selection</span>
                  {filteredCadets.length > 0 && !selectedCadet && (
                    <span className="text-[10px] text-slate-400 font-semibold normal-case">
                      {filteredCadets.length} {filteredCadets.length === 1 ? 'cadet available' : 'cadets available'}
                    </span>
                  )}
                </label>

                {selectedCadet ? (
                  /* Active Selected Cadet Chip */
                  <div className="flex items-center justify-between p-2 pl-3 bg-gradient-to-r from-[#2D3092]/5 to-indigo-50/40 border-2 border-[#2D3092]/30 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#2D3092] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                        {selectedCadet.name ? selectedCadet.name.slice(0, 2).toUpperCase() : 'CD'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-[#2D3092] truncate">{selectedCadet.name}</span>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-[#EF1C25]/10 text-[#EF1C25] border border-[#EF1C25]/20 shrink-0">
                            {selectedCadet.employee_id}
                          </span>
                        </div>
                        {selectedCadet.phone && (
                          <span className="text-[11px] text-slate-500 font-medium">Ph: {selectedCadet.phone}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCadetId(null);
                          setCadetSearchQuery('');
                          setIsDropdownOpen(true);
                        }}
                        className="text-xs font-bold text-[#2D3092] hover:text-white px-3 py-1.5 rounded-xl border border-[#2D3092]/30 hover:bg-[#2D3092] transition-all shadow-sm"
                      >
                        Switch Cadet
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectCadet(null);
                          setCadetSearchQuery('');
                        }}
                        title="Clear selection"
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Search & Autocomplete Input */
                  <div className="relative">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search cadet by Name or Regt ID (e.g. TG24SDA175845)..."
                        className="block w-full border border-slate-300 rounded-xl py-2.5 pl-9 pr-20 focus:ring-2 focus:ring-[#2D3092] focus:border-[#2D3092] text-xs font-bold text-slate-900 bg-white placeholder:font-normal placeholder:text-slate-400 shadow-sm"
                        value={cadetSearchQuery}
                        onChange={(e) => {
                          setCadetSearchQuery(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (filteredCadets.length > 0) {
                              handleSelectCadet(filteredCadets[0].id);
                              setIsDropdownOpen(false);
                              setCadetSearchQuery('');
                            }
                          } else if (e.key === 'Escape') {
                            setIsDropdownOpen(false);
                          }
                        }}
                      />
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />

                      <div className="absolute right-2 top-2 flex items-center gap-1">
                        {cadetSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setCadetSearchQuery('')}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                            title="Clear search"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsDropdownOpen(prev => !prev)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
                          title="Toggle cadet list"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Floating Dropdown Menu */}
                    {isDropdownOpen && (
                      <div className="absolute z-30 mt-1.5 w-full bg-white rounded-2xl shadow-xl border border-slate-200 max-h-72 overflow-y-auto py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                        {loadingCadets ? (
                          <div className="px-4 py-3 text-xs text-slate-500 font-medium text-center">
                            Loading cadets...
                          </div>
                        ) : filteredCadets.length === 0 ? (
                          <div className="px-4 py-4 text-center">
                            <p className="text-xs font-bold text-slate-700">No cadets found</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              No cadet matched "{cadetSearchQuery}"
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                              <span>Cadets ({filteredCadets.length})</span>
                              <span className="normal-case font-normal text-[10px] text-slate-400">Click or press Enter to select</span>
                            </div>
                            {filteredCadets.map((cadet) => (
                              <button
                                key={cadet.id}
                                type="button"
                                onClick={() => {
                                  handleSelectCadet(cadet.id);
                                  setIsDropdownOpen(false);
                                  setCadetSearchQuery('');
                                }}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-indigo-50/40 flex items-center justify-between gap-3 border-b border-slate-50 last:border-0 transition-colors cursor-pointer group"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-[#2D3092]/10 group-hover:bg-[#2D3092] group-hover:text-white text-[#2D3092] font-black text-xs flex items-center justify-center shrink-0 transition-colors">
                                    {cadet.name ? cadet.name.slice(0, 2).toUpperCase() : 'CD'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-black text-slate-900 group-hover:text-[#2D3092] truncate transition-colors">
                                      {cadet.name}
                                    </p>
                                    <p className="text-[10px] text-slate-500 font-medium">
                                      {cadet.phone || 'No phone'}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 group-hover:bg-[#EF1C25]/10 group-hover:text-[#EF1C25] group-hover:border-[#EF1C25]/30 shrink-0 transition-colors">
                                  {cadet.employee_id}
                                </span>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Export Cadet CSV Button */}
              {selectedCadet && (
                <button
                  type="button"
                  onClick={handleExportIndividual}
                  className="bg-[#EF1C25] hover:bg-[#C7131B] text-white px-5 py-2.5 rounded-xl font-bold flex items-center space-x-2 shadow-md border-b-2 border-[#FFCB06] transition-all text-sm shrink-0"
                >
                  <Download className="w-4 h-4 text-[#FFCB06]" />
                  <span>Export Cadet Log (CSV)</span>
                </button>
              )}
            </div>
          </div>

          {selectedCadet ? (
            <div className="space-y-6">
              {/* Cadet Profile & Key Summary Stats */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-5">
                {/* Cadet Info Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#2D3092]/10 border border-[#2D3092]/20 flex items-center justify-center text-[#2D3092] font-black text-lg shadow-sm">
                      {selectedCadet.name ? selectedCadet.name.slice(0, 2).toUpperCase() : 'CD'}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-[#2D3092]">{selectedCadet.name}</h3>
                      <p className="text-xs font-bold text-slate-500">
                        Cadet Regt ID: <span className="text-[#EF1C25] font-black">{selectedCadet.employee_id}</span>
                        {selectedCadet.phone && <span> • Ph: {selectedCadet.phone}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3.5 py-1 bg-[#00AEEF]/10 text-[#00AEEF] border border-[#00AEEF]/30 rounded-full text-xs font-bold">
                      {selectedCadet.role || 'CADET'}
                    </span>
                  </div>
                </div>

                {/* Summary Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50/50 p-4 rounded-xl border border-indigo-100 shadow-sm">
                    <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">All-Time Drills</p>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <p className="text-2xl font-black text-[#2D3092]">
                        {cadetSummary?.overall_present_days ?? '—'}
                      </p>
                      {cadetSummary?.overall_total_sessions ? (
                        <span className="text-xs font-bold text-slate-500">
                          / {cadetSummary.overall_total_sessions} Drills
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Lifetime attended drill sessions</p>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 rounded-xl border border-emerald-100 shadow-sm">
                    <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">This Month's Drills</p>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <p className="text-2xl font-black text-emerald-700">
                        {cadetSummary?.month_present_days ?? '—'}
                      </p>
                      {cadetSummary?.month_total_sessions ? (
                        <span className="text-xs font-bold text-slate-500">
                          / {cadetSummary.month_total_sessions} Sessions
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Sessions attended this month</p>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50/50 p-4 rounded-xl border border-blue-100 shadow-sm">
                    <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Attendance Rate</p>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <p className="text-2xl font-black text-[#2D3092]">
                        {cadetSummary?.overall_attendance_pct != null ? `${cadetSummary.overall_attendance_pct}%` : '—'}
                      </p>
                      {cadetSummary?.month_attendance_pct != null && (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {cadetSummary.month_attendance_pct}% mo
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                      {cadetSummary?.overall_late_count ? `${cadetSummary.overall_late_count} late arrivals recorded` : 'Overall parade attendance rate'}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 rounded-xl border border-amber-100 shadow-sm">
                    <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Total Recorded Logs</p>
                    <p className="text-2xl font-black text-amber-700 mt-1">
                      {cadetRecords.length}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Verified check-in entries on file</p>
                  </div>
                </div>
              </div>

              {/* Individual Cadet Drill Attendance Cards */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-4">
                <div className="flex items-center justify-between mb-4 px-1">
                  <div>
                    <h4 className="text-sm font-black text-[#2D3092] uppercase tracking-wider">
                      Drill History — {selectedCadet.name}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">Chronological record of Fall-In, Visarjan, and selfies</p>
                  </div>
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                    {cadetRecords.length} {cadetRecords.length === 1 ? 'Record' : 'Records'}
                  </span>
                </div>

                {loadingIndividual ? (
                  <div className="text-center py-12 text-gray-500">
                    <p className="text-sm font-medium">Loading cadet drill records...</p>
                  </div>
                ) : cadetRecords.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm font-medium">No attendance logs found for this cadet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cadetRecords.map((record) => renderAttendanceCard(record, selectedCadet))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {loadingCadets ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                  <div className="animate-spin w-8 h-8 border-3 border-[#2D3092] border-t-transparent rounded-full mx-auto mb-3"></div>
                  <p className="text-sm font-bold text-slate-700">Loading battalion cadets...</p>
                </div>
              ) : filteredCadets.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="text-sm font-black text-[#2D3092] uppercase tracking-wider flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#00AEEF]" />
                        <span>
                          {cadetSearchQuery.trim() ? `Search Results for "${cadetSearchQuery}"` : 'Battalion Cadets'}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Select a cadet below to inspect individual attendance records, selfies, and GPS drill history.
                      </p>
                    </div>
                    <span className="text-xs font-black text-[#2D3092] bg-[#2D3092]/10 px-3 py-1 rounded-full border border-[#2D3092]/20">
                      {filteredCadets.length} {filteredCadets.length === 1 ? 'Cadet' : 'Cadets'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                    {filteredCadets.map((cadet) => (
                      <button
                        key={cadet.id}
                        type="button"
                        onClick={() => {
                          handleSelectCadet(cadet.id);
                          setIsDropdownOpen(false);
                          setCadetSearchQuery('');
                        }}
                        className="p-4 rounded-xl border border-slate-200 hover:border-[#2D3092] bg-slate-50/60 hover:bg-indigo-50/40 transition-all cursor-pointer shadow-sm hover:shadow-md group flex flex-col justify-between text-left gap-3 w-full"
                      >
                        <div className="flex items-start gap-3 w-full">
                          <div className="w-10 h-10 rounded-xl bg-[#2D3092] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                            {cadet.name ? cadet.name.slice(0, 2).toUpperCase() : 'CD'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="text-sm font-black text-slate-900 group-hover:text-[#2D3092] truncate transition-colors">
                              {cadet.name}
                            </h5>
                            <p className="text-xs font-bold text-[#EF1C25] mt-0.5">
                              {cadet.employee_id}
                            </p>
                            {cadet.phone && (
                              <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                Ph: {cadet.phone}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="w-full pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-black text-[#2D3092] group-hover:text-[#EF1C25] transition-colors">
                          <span>View Attendance Profile</span>
                          <span>→</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center space-y-3">
                  <Search className="w-12 h-12 mx-auto text-slate-300" />
                  <h4 className="text-base font-bold text-slate-800">No Cadets Found</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                    No cadet matched "{cadetSearchQuery}". Try checking the spelling or search by Cadet Regt ID.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCadetSearchQuery('')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#2D3092] bg-[#2D3092]/10 hover:bg-[#2D3092]/20 transition-colors"
                  >
                    <span>Clear search filter</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Attendance;
