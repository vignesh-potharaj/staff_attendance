import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useNavigate } from 'react-router-dom';
import api, { getApiErrorMessage } from '../services/api';
import { Camera, MapPin, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

const MarkAttendance: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const getLocation = () => {
    setError('');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (err) => {
          console.error(err);
          setError('Location access denied or unavailable. Geofencing requires GPS location.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setError('Geolocation is not supported by your browser.');
    }
  };

  useEffect(() => {
    getLocation();
  }, []);

  const capture = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setImgSrc(imageSrc);
    }
  };

  const dataURLtoFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const handleSubmit = async (action: 'check-in' | 'check-out') => {
    if (!imgSrc) {
      setError('Please capture a photo before submitting.');
      return;
    }
    if (!location) {
      setError('Location is required. Please allow GPS location.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const file = dataURLtoFile(imgSrc, 'attendance_photo.jpg');
      const formData = new FormData();
      formData.append('latitude', location.lat.toString());
      formData.append('longitude', location.lng.toString());
      formData.append('device_info', 'Web Staff Portal');
      formData.append('photo', file);

      const endpoint = action === 'check-in' ? '/attendance/mark' : '/attendance/check-out';
      const response = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const attStatus = response.data?.status || 'recorded';
      if ('Notification' in window && Notification.permission === 'granted') {
        if (action === 'check-in') {
          new Notification('Fall-In Successful ✅', {
            body: `Your fall-in has been recorded (${attStatus}).`
          });
        } else {
          new Notification('Visarjan Successful 🏁', {
            body: 'Your visarjan has been recorded successfully.'
          });
        }
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, `Failed to ${action === 'check-in' ? 'fall in' : 'complete visarjan'}`));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center p-8 text-center">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-16 h-16 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Success!</h1>
        <p className="text-gray-600 mb-8">Your attendance action has been recorded successfully.</p>
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={() => navigate('/staff/dashboard')}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => navigate('/staff/attendance-history')}
            className="w-full border border-slate-300 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-50 transition-all"
          >
            View History
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto w-full">
      <main className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-black text-[#2D3092] uppercase tracking-tight">Mark Cadet Attendance</h1>
          <p className="text-xs font-bold text-[#00AEEF]">Parade Selfie Capture & Geofence Verification</p>
        </div>

        {/* Webcam Section */}
        <div className="relative aspect-square rounded-3xl overflow-hidden bg-slate-900 shadow-2xl border-4 border-[#FFCB06]">
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
                className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#EF1C25] text-white p-4 rounded-full border-2 border-[#FFCB06] shadow-2xl hover:scale-110 active:scale-95 transition-all"
              >
                <Camera className="w-8 h-8 text-white" />
              </button>
            </>
          ) : (
            <div className="relative w-full h-full">
              <img src={imgSrc} className="w-full h-full object-cover" />
              <button
                onClick={() => setImgSrc(null)}
                className="absolute top-4 right-4 bg-black/60 p-2.5 rounded-full text-white hover:bg-black"
              >
                <RefreshCw className="w-5 h-5 text-[#FFCB06]" />
              </button>
            </div>
          )}
        </div>

        {/* Location Section */}
        <div className={`p-4 rounded-2xl border transition-all ${location ? 'bg-[#00AEEF]/10 border-[#00AEEF]/40' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${location ? 'bg-[#00AEEF] text-white' : 'bg-slate-100 text-slate-500'}`}>
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="font-black text-[#2D3092] text-sm">Parade Ground GPS Access</p>
                <p className="text-xs font-semibold text-slate-500">
                  {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Required for geofence verification'}
                </p>
              </div>
            </div>
            {!location && (
              <button
                onClick={getLocation}
                className="text-xs font-black text-[#EF1C25] bg-[#EF1C25]/10 px-3 py-1.5 rounded-xl hover:bg-[#EF1C25] hover:text-white transition-all"
              >
                Allow GPS
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl flex items-center gap-2 text-xs font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => handleSubmit('check-in')}
            disabled={loading || !imgSrc || !location}
            className={`flex-1 py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 transition-all border-b-2 border-[#FFCB06] text-sm uppercase tracking-wider ${
              loading || !imgSrc || !location 
              ? 'bg-slate-200 text-slate-400 border-none cursor-not-allowed' 
              : 'bg-[#2D3092] text-white hover:bg-[#3F43B5] hover:-translate-y-0.5'
            }`}
          >
            {loading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <>Cadet Fall In</>}
          </button>
          
          <button
            onClick={() => handleSubmit('check-out')}
            disabled={loading || !imgSrc || !location}
            className={`flex-1 py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 transition-all border-b-2 border-[#FFCB06] text-sm uppercase tracking-wider ${
              loading || !imgSrc || !location 
              ? 'bg-slate-200 text-slate-400 border-none cursor-not-allowed' 
              : 'bg-[#EF1C25] text-white hover:bg-[#C7131B] hover:-translate-y-0.5'
            }`}
          >
            {loading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <>Cadet Visarjan</>}
          </button>
        </div>
      </main>
    </div>
  );
};

export default MarkAttendance;
