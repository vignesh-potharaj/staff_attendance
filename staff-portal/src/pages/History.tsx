import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar, Clock, MapPin, Search } from 'lucide-react';
import api from '../services/api';

interface AttendanceRecord {
  id: number;
  date: string;
  status: string;
  check_in_time: string;
  latitude: number;
  longitude: number;
  photo_url: string;
}

const History: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.get('/attendance/history');
        setRecords(response.data);
      } catch {
        console.error('Failed to fetch history');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-10">
      <header className="bg-white border-b px-4 py-4 flex items-center sticky top-0 z-10">
        <button onClick={() => navigate('/')} className="p-2 -ml-2 text-gray-500">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center font-bold text-gray-900 mr-8">Attendance History</h1>
      </header>

      <main className="px-6 py-6 max-w-md mx-auto w-full space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 font-medium">Loading history...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No records found</h3>
            <p className="text-gray-500">You haven't marked attendance yet.</p>
          </div>
        ) : (
          records.map((record) => (
            <div key={record.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-gray-100">
                <img src={`http://localhost:8000${record.photo_url}`} className="w-full h-full object-cover" alt="Check-in selfie" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    {record.date}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    record.status === 'PRESENT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {record.status}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  Clock-in: {new Date(record.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <MapPin className="w-3.5 h-3.5" />
                  {record.latitude.toFixed(4)}, {record.longitude.toFixed(4)}
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default History;
