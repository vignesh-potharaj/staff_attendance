import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, MapPin, CheckCircle2, AlertCircle, RefreshCw, LogOut, History as HistoryIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const MarkAttendance: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setImgSrc(imageSrc);
    }
  }, [webcamRef]);

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      () => {
        setError('Unable to retrieve your location. Please enable GPS.');
      }
    );
  };

  const dataURLtoFile = (dataurl: string, filename: string) => {
    let arr = dataurl.split(','),
        mime = arr[0].match(/:(.*?);/)![1],
        bstr = atob(arr[1]), 
        n = bstr.length, 
        u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
  }

  const handleSubmit = async () => {
    if (!imgSrc || !location) {
      setError('Please capture a photo and allow location access');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const file = dataURLtoFile(imgSrc, 'attendance_photo.jpg');
      const formData = new FormData();
      formData.append('latitude', location.lat.toString());
      formData.append('longitude', location.lng.toString());
      formData.append('device_info', 'Web Staff Portal');
      formData.append('photo', file);

      await api.post('/attendance/mark', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to record attendance');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <CheckCircle2 className="w-16 h-16 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Success!</h1>
        <p className="text-gray-600 mb-8">Your attendance has been recorded for today.</p>
        <button
          onClick={() => navigate('/history')}
          className="w-full max-w-xs bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all"
        >
          View History
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
            {user?.name.charAt(0)}
          </div>
          <div>
            <h2 className="font-bold text-gray-900">{user?.name}</h2>
            <p className="text-xs text-gray-500">ID: {user?.employee_id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => navigate('/history')}
            className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
          >
            <HistoryIcon className="w-6 h-6" />
          </button>
          <button 
            onClick={logout}
            className="p-2 text-gray-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6 max-w-md mx-auto w-full">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Mark Attendance</h1>
          <p className="text-sm text-gray-500">Capture a selfie and your location</p>
        </div>

        {/* Webcam Section */}
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-black shadow-inner border-4 border-white">
          {!imgSrc ? (
            <>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                className="w-full h-full object-cover"
              />
              <button
                onClick={capture}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/30 backdrop-blur-md p-4 rounded-full border-2 border-white shadow-xl hover:scale-110 transition-all"
              >
                <Camera className="w-8 h-8 text-white" />
              </button>
            </>
          ) : (
            <div className="relative w-full h-full">
              <img src={imgSrc} className="w-full h-full object-cover" />
              <button
                onClick={() => setImgSrc(null)}
                className="absolute top-4 right-4 bg-black/50 p-2 rounded-full text-white"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Location Section */}
        <div className={`p-4 rounded-2xl border transition-all ${location ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${location ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-gray-900">Location Access</p>
                <p className="text-xs text-gray-500">
                  {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Required for verification'}
                </p>
              </div>
            </div>
            {!location && (
              <button
                onClick={getLocation}
                className="text-sm font-bold text-blue-600 hover:underline"
              >
                Allow
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !imgSrc || !location}
          className={`w-full py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2 transition-all ${
            loading || !imgSrc || !location 
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-1'
          }`}
        >
          {loading ? (
            <RefreshCw className="w-6 h-6 animate-spin" />
          ) : (
            <>Submit Attendance</>
          )}
        </button>
      </main>
    </div>
  );
};

export default MarkAttendance;
