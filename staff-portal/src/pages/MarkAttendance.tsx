import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useNavigate } from 'react-router-dom';
import api, { getApiErrorMessage } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Camera, MapPin, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface DutyLocationInfo {
  id?: number;
  name: string;
  radius_meters: number;
  maps_link?: string;
  is_custom_post: boolean;
}

const MarkAttendance: React.FC = () => {
  const { user } = useAuth();
  const webcamRef = useRef<Webcam>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [sessionActive, setSessionActive] = useState<boolean>(true);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [requireLocation, setRequireLocation] = useState<boolean>(true);
  const [dutyLocation, setDutyLocation] = useState<DutyLocationInfo | null>(null);
  const [isVisarjanPassed, setIsVisarjanPassed] = useState<boolean>(false);
  const [visarjanTimeStr, setVisarjanTimeStr] = useState<string | null>(null);
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
          if (requireLocation) {
            setError('Location access denied or unavailable. Geofencing requires GPS location.');
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else if (requireLocation) {
      setError('Geolocation is not supported by your browser.');
    }
  };

  useEffect(() => {
    getLocation();
    const checkSession = async () => {
      try {
        const res = await api.get('/roaster/session/status');
        if (res.data) {
          setSessionActive(Boolean(res.data.is_active));
          if (res.data.session) {
            setSessionTitle(res.data.session.title);
            setRequireLocation(res.data.session.require_location !== false);
            setIsVisarjanPassed(Boolean(res.data.session.is_visarjan_passed));
            setVisarjanTimeStr(res.data.session.end_time || null);
            if (res.data.session.location) {
              setDutyLocation({
                id: res.data.session.location.id,
                name: res.data.session.location.name,
                radius_meters: res.data.session.location.radius_meters,
                maps_link: res.data.session.location.maps_link,
                is_custom_post: false,
              });
            }
          }
        }

        // Check if current cadet has a specific duty assignment for today
        if (user?.id) {
          const todayDate = new Date().toISOString().split('T')[0];
          try {
            const roasterRes = await api.get('/roaster/staff/my-roaster', {
              params: { start_date: todayDate, end_date: todayDate }
            });
            if (Array.isArray(roasterRes.data) && roasterRes.data.length > 0) {
              const cadetRoaster = roasterRes.data[0];
              if (cadetRoaster.location) {
                setDutyLocation({
                  id: cadetRoaster.location.id,
                  name: cadetRoaster.location.name,
                  radius_meters: cadetRoaster.location.radius_meters,
                  maps_link: cadetRoaster.location.maps_link,
                  is_custom_post: true,
                });
              }
            }
          } catch {
            // Optional
          }
        }
      } catch {
        // Fallback: allow, backend will validate
      } finally {
        setSessionChecking(false);
      }
    };
    checkSession();
  }, [user?.id]);

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
    if (requireLocation && !location) {
      setError('Location is required for this session. Please allow GPS location.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const file = dataURLtoFile(imgSrc, 'attendance_photo.jpg');
      const formData = new FormData();
      formData.append('latitude', location ? location.lat.toString() : '0');
      formData.append('longitude', location ? location.lng.toString() : '0');
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

  if (!sessionChecking && !sessionActive) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center p-8 text-center space-y-5">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center font-bold">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-black text-[#2D3092]">No Active Parade Session</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Attendance is closed because no drill or parade session is active today.
            Sessions are activated on-demand by your instructor when drills commence.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/staff/dashboard')}
          className="w-full bg-[#2D3092] hover:bg-[#3F43B5] text-white py-3.5 rounded-xl font-black text-sm shadow-md transition-all cursor-pointer border-b-2 border-[#FFCB06]"
        >
          Return to Cadet Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto w-full">
      <main className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-black text-[#2D3092] uppercase tracking-tight">Mark Cadet Attendance</h1>
          <p className="text-xs font-bold text-[#00AEEF]">Session Selfie Capture & Geofence Verification</p>
          {sessionTitle && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Active Session: {sessionTitle}</span>
            </div>
          )}
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
        <div className={`p-4 rounded-2xl border transition-all ${
          !requireLocation
            ? 'bg-amber-50/70 border-amber-300 shadow-xs'
            : location 
              ? 'bg-[#00AEEF]/10 border-[#00AEEF]/40' 
              : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                !requireLocation
                  ? 'bg-amber-500 text-white'
                  : location 
                    ? 'bg-[#00AEEF] text-white' 
                    : 'bg-slate-100 text-slate-500'
              }`}>
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-black text-[#2D3092] text-sm">
                    {!requireLocation
                      ? 'Open Location Mode (Geofence OFF)'
                      : dutyLocation
                        ? `${dutyLocation.is_custom_post ? 'Assigned Duty Post' : 'Parade Ground'}: ${dutyLocation.name}`
                        : 'Session Ground GPS Access'}
                  </p>
                  {requireLocation && dutyLocation?.is_custom_post && (
                    <span className="px-2 py-0.5 bg-[#EF1C25] text-white text-[10px] font-black uppercase rounded-md tracking-wider">
                      Specific Station
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  {!requireLocation
                    ? 'Instructor disabled geofence for multi-post/distributed duty. GPS optional.'
                    : dutyLocation
                      ? `Within ${dutyLocation.radius_meters}m perimeter • ${location ? `GPS: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Waiting for GPS fix...'}`
                      : location 
                        ? `GPS: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` 
                        : 'Required for geofence verification'}
                </p>
                {requireLocation && dutyLocation?.maps_link && (
                  <a
                    href={dutyLocation.maps_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#EF1C25] hover:underline mt-1"
                  >
                    Open Post on Google Maps →
                  </a>
                )}
              </div>
            </div>
            {requireLocation && !location && (
              <button
                onClick={getLocation}
                className="text-xs font-black text-[#EF1C25] bg-[#EF1C25]/10 px-3 py-1.5 rounded-xl hover:bg-[#EF1C25] hover:text-white transition-all cursor-pointer shrink-0"
              >
                Allow GPS
              </button>
            )}
          </div>
        </div>

        {isVisarjanPassed && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-2xl flex items-center gap-2 text-xs font-bold">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Visarjan time ({visarjanTimeStr || '12:30'}) has passed. Fall-In attendance is closed.</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl flex items-center gap-2 text-xs font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => handleSubmit('check-in')}
            disabled={loading || isVisarjanPassed || !imgSrc || (requireLocation && !location)}
            className={`flex-1 py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 transition-all border-b-2 border-[#FFCB06] text-sm uppercase tracking-wider ${
              loading || isVisarjanPassed || !imgSrc || (requireLocation && !location)
              ? 'bg-slate-200 text-slate-400 border-none cursor-not-allowed' 
              : 'bg-[#2D3092] text-white hover:bg-[#3F43B5] hover:-translate-y-0.5 cursor-pointer'
            }`}
          >
            {loading ? <RefreshCw className="w-6 h-6 animate-spin" /> : isVisarjanPassed ? <>Fall In Closed</> : <>Cadet Fall In</>}
          </button>
          
          <button
            onClick={() => handleSubmit('check-out')}
            disabled={loading || !imgSrc || (requireLocation && !location)}
            className={`flex-1 py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 transition-all border-b-2 border-[#FFCB06] text-sm uppercase tracking-wider ${
              loading || !imgSrc || (requireLocation && !location)
              ? 'bg-slate-200 text-slate-400 border-none cursor-not-allowed' 
              : 'bg-[#EF1C25] text-white hover:bg-[#C7131B] hover:-translate-y-0.5 cursor-pointer'
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
