import React, { useEffect, useState } from 'react';
import { Share2, Copy, Calendar as CalendarIcon, User as UserIcon, Clock, Zap, Square, X, Bell, Save, Check } from 'lucide-react';
import api, { getApiErrorMessage } from '../services/api';

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
  startTime: string;
  endTime: string;
}

interface SessionData {
  id: number;
  date: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  notes?: string | null;
}

interface SessionStatusResponse {
  has_session: boolean;
  is_active: boolean;
  today_date: string;
  session: SessionData | null;
}

const TodayRoaster: React.FC = () => {
  // Rebuild trigger - v2
  const [users, setUsers] = useState<User[]>([]);
  const [schedules, setSchedules] = useState<Record<number, ScheduleInput>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Session State
  const [sessionStatus, setSessionStatus] = useState<SessionStatusResponse | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [drillType, setDrillType] = useState('Sunday Regular Parade');
  const [sessionTitle, setSessionTitle] = useState('Sunday Regular Parade');
  const [customEventTitle, setCustomEventTitle] = useState('');
  const [sessionStartTime, setSessionStartTime] = useState('07:00');
  const [sessionEndTime, setSessionEndTime] = useState('09:30');
  const [sessionNotes, setSessionNotes] = useState('');
  const [notifyCadets, setNotifyCadets] = useState(true);
  const [sessionSubmitting, setSessionSubmitting] = useState(false);

  // Preset Drill Names for Identification
  const PRESET_DRILL_TITLES = ['Sunday Regular Parade', 'Regular Parade', 'Weapon Drill Training', 'Weapon Drill', 'Camp Drill Training', 'Camp Training'];

  const populateSessionFields = (session?: SessionData | null) => {
    if (session) {
      const isPreset = PRESET_DRILL_TITLES.includes(session.title);
      if (isPreset) {
        setDrillType(session.title.includes('Regular') ? 'Sunday Regular Parade' : session.title.includes('Weapon') ? 'Weapon Drill Training' : 'Camp Drill Training');
        setSessionTitle(session.title);
        setCustomEventTitle('');
      } else {
        setDrillType('Special Event');
        setCustomEventTitle(session.title);
        setSessionTitle(session.title);
      }
      if (session.start_time) setSessionStartTime(session.start_time.substring(0, 5));
      if (session.end_time) setSessionEndTime(session.end_time.substring(0, 5));
      if (session.notes) setSessionNotes(session.notes);
    } else {
      setDrillType('Sunday Regular Parade');
      setSessionTitle('Sunday Regular Parade');
      setCustomEventTitle('');
      setSessionStartTime('07:00');
      setSessionEndTime('09:30');
      setSessionNotes('');
    }
  };

  // History State
  const [historyDate, setHistoryDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySession, setHistorySession] = useState<SessionStatusResponse | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      const todayDate = new Date().toLocaleDateString('en-CA');
      
      // Debug: Check if token exists
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      
      const [uRes, rRes, sRes] = await Promise.all([
        api.get('/users/'),
        api.get(`/roaster/?date=${todayDate}`),
        api.get(`/roaster/session/status?date=${todayDate}`)
      ]);
      
      const staffOnly = uRes.data.filter((u: User) => u.role === 'STAFF');
      setUsers(staffOnly);
      setSessionStatus(sRes.data);

      if (sRes.data?.session) {
        populateSessionFields(sRes.data.session);
      }

      const existingRoasters = rRes.data || [];
      const roasterMap: Record<number, any> = {};
      existingRoasters.forEach((r: any) => {
        roasterMap[r.user_id] = r;
      });

      const sessionObj = sRes.data?.session;
      const defStartTime = sessionObj?.start_time ? sessionObj.start_time.substring(0, 5) : '07:00';
      const defEndTime = sessionObj?.end_time ? sessionObj.end_time.substring(0, 5) : '09:30';

      const initialSchedules: Record<number, ScheduleInput> = {};
      staffOnly.forEach((u: User) => {
        const r = roasterMap[u.id];
        initialSchedules[u.id] = {
           startTime: (r && r.start_time) ? r.start_time.substring(0, 5) : defStartTime,
           endTime: (r && r.end_time) ? r.end_time.substring(0, 5) : defEndTime
        };
      });
      setSchedules(initialSchedules);
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, 'Failed to fetch roaster data');
      setError(errorMsg);
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (date: string) => {
    setHistoryLoading(true);
    try {
      const [rRes, sRes] = await Promise.all([
        api.get(`/roaster/?date=${date}`),
        api.get(`/roaster/session/status?date=${date}`)
      ]);
      setHistoryRecords(rRes.data || []);
      setHistorySession(sRes.data);
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleActivateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionSubmitting(true);
    try {
      const todayDate = new Date().toLocaleDateString('en-CA');
      const titleToSave = drillType === 'Special Event'
        ? (customEventTitle.trim() || 'Special Event')
        : sessionTitle.trim();

      if (drillType === 'Special Event' && !customEventTitle.trim()) {
        alert('Please enter a name or occasion for the Special Event.');
        setSessionSubmitting(false);
        return;
      }

      await api.post('/roaster/session/activate', {
        date: todayDate,
        title: titleToSave,
        start_time: sessionStartTime,
        end_time: sessionEndTime,
        notes: sessionNotes,
        send_notification: notifyCadets
      });

      setIsSessionModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Failed to activate session', err);
      alert(getApiErrorMessage(err, 'Failed to activate session'));
    } finally {
      setSessionSubmitting(false);
    }
  };

  const handleDeactivateSession = async () => {
    if (!window.confirm('Are you sure you want to conclude/deactivate this parade session? Cadets will no longer be able to mark attendance for today.')) {
      return;
    }
    setSessionLoading(true);
    try {
      const todayDate = new Date().toLocaleDateString('en-CA');
      await api.post(`/roaster/session/deactivate?date=${todayDate}`);
      await fetchData();
    } catch (err) {
      console.error('Failed to deactivate session', err);
      alert(getApiErrorMessage(err, 'Failed to conclude session'));
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchHistory(historyDate);
  }, []);


  const handleTimeChange = (userId: number, field: 'startTime' | 'endTime', value: string) => {
    setSchedules(prev => ({
      ...prev,
      [userId]: {
        startTime: prev[userId]?.startTime || (sessionStatus?.session?.start_time ? sessionStatus.session.start_time.substring(0, 5) : '07:00'),
        endTime: prev[userId]?.endTime || (sessionStatus?.session?.end_time ? sessionStatus.session.end_time.substring(0, 5) : '09:30'),
        [field]: value
      }
    }));
  };

  const handleResetCadetTime = (userId: number) => {
    const sessionObj = sessionStatus?.session;
    const defStartTime = sessionObj?.start_time ? sessionObj.start_time.substring(0, 5) : '07:00';
    const defEndTime = sessionObj?.end_time ? sessionObj.end_time.substring(0, 5) : '09:30';
    setSchedules(prev => ({
      ...prev,
      [userId]: {
        startTime: defStartTime,
        endTime: defEndTime
      }
    }));
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

  const saveRoasterPayload = async () => {
    const todayDate = new Date().toLocaleDateString('en-CA');
    const sessionObj = sessionStatus?.session;
    const defStartTime = sessionObj?.start_time ? sessionObj.start_time.substring(0, 5) : '07:00';
    const defEndTime = sessionObj?.end_time ? sessionObj.end_time.substring(0, 5) : '09:30';

    const payload = users.map(u => {
      const s = schedules[u.id];
      const st = s?.startTime || defStartTime;
      const et = s?.endTime || defEndTime;
      return {
        user_id: u.id,
        date: todayDate,
        start_time: st.length === 5 ? `${st}:00` : st,
        end_time: et.length === 5 ? `${et}:00` : et,
        is_leave: false,
        is_week_off: false
      };
    });

    await api.post(`/roaster/bulk?date=${todayDate}`, payload);
    fetchHistory(todayDate); // Refresh history if viewing today
  };

  const handleSave = async () => {
    try {
      await saveRoasterPayload();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save roaster', err);
      alert(getApiErrorMessage(err, 'Failed to save roaster schedule.'));
    }
  };

  const handleSaveAndShare = async () => {
    try {
      await saveRoasterPayload();

      const todayFormatted = new Date().toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });

      const sessionObj = sessionStatus?.session;
      const defStartTime = sessionObj?.start_time ? sessionObj.start_time.substring(0, 5) : '07:00';
      const defEndTime = sessionObj?.end_time ? sessionObj.end_time.substring(0, 5) : '09:30';

      let message = `📅 *Cadet Drill Duty Roster - ${todayFormatted}*\n`;
      if (sessionStatus?.is_active && sessionObj?.title) {
        message += `🎖️ *Parade Session*: ${sessionObj.title}\n`;
        message += `⏰ *Session Timings*: ${formatTime12h(defStartTime)} - ${formatTime12h(defEndTime)}\n`;
      }
      message += `------------------------------------------\n\n`;
      message += `*Cadet Reporting Schedule*:\n`;

      users.forEach((user, index) => {
        const schedule = schedules[user.id];
        const sTime = schedule?.startTime || defStartTime;
        const eTime = schedule?.endTime || defEndTime;
        const isCustom = sTime !== defStartTime || eTime !== defEndTime;
        const customTag = sTime < defStartTime ? ' *(Early Duty)*' : (sTime > defStartTime ? ' *(Late Reporting)*' : (isCustom ? ' *(Special Timing)*' : ''));

        message += `${index + 1}. *${user.name}* (${user.employee_id})\n`;
        message += `   ⏰ ${formatTime12h(sTime)} - ${formatTime12h(eTime)}${customTag}\n`;
      });

      message += `\n------------------------------------------\n`;
      message += `_Fall-in at parade ground in proper uniform. Jai Hind!_`;

      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    } catch (err) {
      console.error('Failed to save and share roaster', err);
      alert(getApiErrorMessage(err, 'Failed to save and share roaster.'));
    }
  };

  const handleSaveAndCopy = async () => {
    try {
      await saveRoasterPayload();

      const todayFormatted = new Date().toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });

      const sessionObj = sessionStatus?.session;
      const defStartTime = sessionObj?.start_time ? sessionObj.start_time.substring(0, 5) : '07:00';
      const defEndTime = sessionObj?.end_time ? sessionObj.end_time.substring(0, 5) : '09:30';

      let message = `📅 Cadet Drill Duty Roster - ${todayFormatted}\n`;
      if (sessionStatus?.is_active && sessionObj?.title) {
        message += `🎖️ Parade Session: ${sessionObj.title}\n`;
        message += `⏰ Session Timings: ${formatTime12h(defStartTime)} - ${formatTime12h(defEndTime)}\n`;
      }
      message += `------------------------------------------\n\n`;
      message += `Cadet Reporting Schedule:\n`;

      users.forEach((user, index) => {
        const schedule = schedules[user.id];
        const sTime = schedule?.startTime || defStartTime;
        const eTime = schedule?.endTime || defEndTime;
        const isCustom = sTime !== defStartTime || eTime !== defEndTime;
        const customTag = sTime < defStartTime ? ' (Early Duty)' : (sTime > defStartTime ? ' (Late Reporting)' : (isCustom ? ' (Special Timing)' : ''));

        message += `${index + 1}. ${user.name} (${user.employee_id})\n`;
        message += `   ⏰ ${formatTime12h(sTime)} - ${formatTime12h(eTime)}${customTag}\n`;
      });

      message += `\n------------------------------------------\n`;
      message += `Fall-in at parade ground in proper uniform. Jai Hind!`;

      await navigator.clipboard.writeText(message);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to save and copy roaster', err);
      alert(getApiErrorMessage(err, 'Failed to save and copy roaster.'));
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
            <h2 className="text-2xl font-black text-[#2D3092] flex items-center gap-2 uppercase tracking-tight">
              <CalendarIcon className="text-[#EF1C25]" />
              Session & Drill Schedule (Roster)
            </h2>
            <p className="text-xs text-slate-500 font-bold mt-1">Assign drill timings and publish the session schedule</p>
          </div>
          {sessionStatus?.is_active && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleSave}
                className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 shadow-md transition-all font-bold text-xs sm:text-sm cursor-pointer ${
                  saveSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#2D3092] hover:bg-[#3F43B5] text-white border-b-2 border-[#FFCB06]'
                }`}
                title="Save scheduled reporting timings for all cadets"
              >
                {saveSuccess ? <Check className="w-4 h-4 text-white" /> : <Save className="w-4 h-4 text-[#FFCB06]" />}
                <span>{saveSuccess ? 'Saved!' : 'Save Schedule'}</span>
              </button>
              <button
                onClick={handleSaveAndCopy}
                className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 shadow-md transition-all font-bold text-xs sm:text-sm cursor-pointer ${
                  copySuccess 
                    ? 'bg-[#00AEEF] text-white' 
                    : 'bg-slate-800 hover:bg-slate-900 text-white border-b-2 border-[#00AEEF]'
                }`}
                title="Save roaster and copy schedule to clipboard"
              >
                <Copy className="w-4 h-4 text-[#00AEEF]" />
                <span>{copySuccess ? 'Copied!' : 'Save & Copy'}</span>
              </button>
              <button
                onClick={handleSaveAndShare}
                className="bg-[#EF1C25] hover:bg-[#C7131B] text-white px-4 py-2.5 rounded-xl flex items-center space-x-2 shadow-md border-b-2 border-[#FFCB06] transition-all font-bold text-xs sm:text-sm cursor-pointer"
                title="Save roaster and share on WhatsApp"
              >
                <Share2 className="w-4 h-4 text-[#FFCB06]" />
                <span>Share WhatsApp</span>
              </button>
            </div>
          )}
        </div>

        {/* NCC On-Demand Parade Session Status & Activation Card */}
        <div className={`mb-6 rounded-2xl border p-5 sm:p-6 transition-all shadow-sm ${
          sessionStatus?.is_active
            ? 'bg-gradient-to-r from-emerald-500/10 via-white to-blue-500/10 border-emerald-300 ring-1 ring-emerald-400/30'
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                {sessionStatus?.is_active ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    LIVE PARADE SESSION ACTIVE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-600 border border-slate-300">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    NO ACTIVE SESSION TODAY
                  </span>
                )}
                <span className="text-xs font-mono font-bold text-slate-500">
                  Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-black text-[#2D3092]">
                {sessionStatus?.is_active
                  ? (sessionStatus.session?.title || 'Parade / Drill Session')
                  : 'On-Demand NCC Session Mode'}
              </h3>

              <p className="text-xs text-slate-600">
                {sessionStatus?.is_active ? (
                  <span className="font-semibold text-emerald-700">
                    Drill Timings: {formatTime12h(sessionStatus.session?.start_time || '07:00')} → {formatTime12h(sessionStatus.session?.end_time || '09:30')} • Fall-In attendance is open for cadets.
                  </span>
                ) : (
                  <span>
                    Attendance is currently closed. Cadets cannot mark fall-in until an instructor activates today's session.
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {sessionStatus?.is_active ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      populateSessionFields(sessionStatus?.session);
                      setIsSessionModalOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                  >
                    Edit Session
                  </button>
                  <button
                    type="button"
                    disabled={sessionLoading}
                    onClick={handleDeactivateSession}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Square className="w-3.5 h-3.5 text-red-400 fill-red-400" />
                    <span>{sessionLoading ? 'Closing...' : 'Conclude Session'}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    populateSessionFields(sessionStatus?.session);
                    setIsSessionModalOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#EF1C25] hover:bg-[#C7131B] text-white font-black text-sm shadow-md border-b-2 border-[#FFCB06] transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Zap className="w-4 h-4 text-[#FFCB06] fill-[#FFCB06]" />
                  <span>Activate Session</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {sessionStatus?.is_active ? (
          <div className="space-y-3">
            {users.map((user) => {
              const schedule = schedules[user.id];
              const sessionObj = sessionStatus?.session;
              const defStartTime = sessionObj?.start_time ? sessionObj.start_time.substring(0, 5) : '07:00';
              const defEndTime = sessionObj?.end_time ? sessionObj.end_time.substring(0, 5) : '09:30';
              
              const cadetStartTime = schedule?.startTime || defStartTime;
              const cadetEndTime = schedule?.endTime || defEndTime;
              const isCustom = cadetStartTime !== defStartTime || cadetEndTime !== defEndTime;
              const isEarly = cadetStartTime < defStartTime;
              const isLate = cadetStartTime > defStartTime;

              return (
                <div 
                  key={user.id}
                  className={`relative rounded-2xl border transition-all duration-300 overflow-hidden p-4 sm:p-5 shadow-xs hover:shadow-md ${
                    isCustom
                      ? 'bg-amber-50/20 border-amber-300 hover:border-amber-400 ring-1 ring-amber-200/50'
                      : 'bg-white border-slate-200 hover:border-[#2D3092]/40'
                  }`}
                >
                  {/* NCC Tri-Color Ribbon Top Bar */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 flex z-10">
                    <div className="h-full flex-1 bg-[#EF1C25]" title="Army Red" />
                    <div className="h-full flex-1 bg-[#2D3092]" title="Navy Deep Blue" />
                    <div className="h-full flex-1 bg-[#00AEEF]" title="Air Force Light Blue" />
                  </div>

                  {/* Card content */}
                  <div className="space-y-3 pt-1">
                    {/* Header: Cadet Avatar + Name + Regimental No + Reporting Hours Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#2D3092] border-2 border-[#FFCB06]/40 flex items-center justify-center shadow-xs text-white">
                          <UserIcon className="w-6 h-6 sm:w-7 sm:h-7 text-[#FFCB06]" />
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                              {user.name}
                            </h3>
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-[#2D3092]/10 text-[#2D3092] border border-[#2D3092]/20">
                              Cadet
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              Regt No: {user.employee_id}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Reporting Timing Badge in Header */}
                      <div className="shrink-0 text-right">
                        <span className={`px-3 py-1.5 inline-flex text-xs font-black rounded-xl border items-center gap-1.5 shadow-2xs ${
                          isCustom
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        }`}>
                          <Clock className={`w-3.5 h-3.5 ${isCustom ? 'text-amber-700' : 'text-emerald-700'}`} />
                          <span>{formatTime12h(cadetStartTime)} - {formatTime12h(cadetEndTime)}</span>
                        </span>
                        <div className="mt-1">
                          {isEarly ? (
                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              ⚡ Expected Early
                            </span>
                          ) : isLate ? (
                            <span className="text-[10px] font-black text-orange-700 uppercase tracking-wider bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                              ⏱️ Reporting Late
                            </span>
                          ) : isCustom ? (
                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Custom Timing
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">
                              Session Default
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Duty Reporting Timings Inputs */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#2D3092]" />
                          Cadet Reporting Hours (Adjust if expected early or late):
                        </span>
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => handleResetCadetTime(user.id)}
                            className="text-[11px] font-extrabold text-[#EF1C25] hover:text-[#C7131B] hover:underline cursor-pointer"
                            title="Reset this cadet back to session timing"
                          >
                            Reset to Default ({formatTime12h(defStartTime)} - {formatTime12h(defEndTime)})
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Fall-In (Start Time)
                          </label>
                          <input
                            type="time"
                            value={cadetStartTime}
                            onChange={(e) => handleTimeChange(user.id, 'startTime', e.target.value)}
                            className={`w-full px-3 py-2 text-sm font-black rounded-xl border transition-all cursor-pointer ${
                              cadetStartTime !== defStartTime
                                ? 'bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-300/40'
                                : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-[#2D3092]'
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Visarjan (End Time)
                          </label>
                          <input
                            type="time"
                            value={cadetEndTime}
                            onChange={(e) => handleTimeChange(user.id, 'endTime', e.target.value)}
                            className={`w-full px-3 py-2 text-sm font-black rounded-xl border transition-all cursor-pointer ${
                              cadetEndTime !== defEndTime
                                ? 'bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-300/40'
                                : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white focus:border-[#2D3092]'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-[#2D3092]/10 border border-[#2D3092]/20 flex items-center justify-center mx-auto mb-3.5 text-[#2D3092]">
              <CalendarIcon className="w-7 h-7 text-[#2D3092]" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
              Cadet Roster Hidden (No Active Session)
            </h3>
            <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto mt-1.5 leading-relaxed font-medium">
              Individual cadet cards and drill rosters are only displayed during an active parade session. Click <span className="font-bold text-[#2D3092]">"Activate Session"</span> above to conduct a drill and take attendance.
            </p>
            <button
              type="button"
              onClick={() => {
                populateSessionFields(sessionStatus?.session);
                setIsSessionModalOpen(true);
              }}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#EF1C25] hover:bg-[#C7131B] text-white font-black text-xs sm:text-sm shadow-md border-b-2 border-[#FFCB06] transition-all cursor-pointer active:scale-95"
            >
              <Zap className="w-4 h-4 text-[#FFCB06] fill-[#FFCB06]" />
              <span>Activate Parade Session</span>
            </button>
          </div>
        )}
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
          <div className="flex flex-wrap items-center gap-3">
            {historySession?.has_session && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                historySession.is_active
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}>
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>Session: {historySession.session?.title} {historySession.is_active ? '(Active)' : '(Concluded)'}</span>
              </span>
            )}
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
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Regt / Cadet ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cadet Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reporting Hours</th>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user?.name || 'Cadet'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(r.start_time && r.end_time) ? (
                          <span className="text-[#2D3092] font-black text-xs bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                            {formatTime12h(r.start_time)} - {formatTime12h(r.end_time)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs italic">No timing assigned</span>
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

      {/* Session Activation / Edit Modal */}
      {isSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-[#2D3092] p-5 text-white flex items-center justify-between border-b border-[#1E216B]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#FFCB06]">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {sessionStatus?.is_active ? 'Edit Parade Session' : 'Activate NCC Parade Session'}
                  </h3>
                  <p className="text-[11px] text-[#00AEEF] font-bold">Open on-demand drill attendance for cadets</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSessionModalOpen(false)}
                className="text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleActivateSession} className="p-6 space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Parade / Event Category
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'Sunday Regular Parade', label: 'Regular Parade' },
                        { id: 'Weapon Drill Training', label: 'Weapon Drill' },
                        { id: 'Camp Drill Training', label: 'Camp Drill' },
                        { id: 'Special Event', label: 'Special Event (Custom)' },
                      ].map((cat) => {
                        const isSelected = drillType === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setDrillType(cat.id);
                              if (cat.id !== 'Special Event') {
                                setSessionTitle(cat.id);
                              }
                            }}
                            className={`px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border text-center ${
                              isSelected
                                ? 'bg-[#2D3092] text-white border-[#2D3092] shadow-md ring-2 ring-[#2D3092]/20'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {drillType === 'Special Event' ? (
                    <div className="bg-amber-50/80 border border-amber-300/80 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-black text-amber-950 uppercase tracking-wider">
                          Special Event Name / Occasion <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-full">
                          Custom String
                        </span>
                      </div>
                      <input
                        type="text"
                        required
                        value={customEventTitle}
                        onChange={(e) => setCustomEventTitle(e.target.value)}
                        placeholder="Write special event name (e.g. Independence Day Parade, VIP Guard of Honour...)"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-amber-300 bg-white text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#2D3092] placeholder:text-slate-400 placeholder:font-normal"
                        autoFocus
                      />
                      <p className="text-[11px] text-amber-800/90 font-medium">
                        Instructor note: Cadets will see this custom title on their dashboard and attendance notifications.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Session Title
                      </label>
                      <input
                        type="text"
                        required
                        value={sessionTitle}
                        onChange={(e) => setSessionTitle(e.target.value)}
                        placeholder="e.g. Sunday Regular Parade"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-[#2D3092]"
                      />
                    </div>
                  )}
                </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Fall-In Time (Start)
                  </label>
                  <input
                    type="time"
                    required
                    value={sessionStartTime}
                    onChange={(e) => setSessionStartTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-[#2D3092]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Visarjan Time (End)
                  </label>
                  <input
                    type="time"
                    required
                    value={sessionEndTime}
                    onChange={(e) => setSessionEndTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-[#2D3092]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Ground / Location Notes (Optional)
                </label>
                <input
                  type="text"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="e.g. Main Ground, Uniform: Khaki"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:ring-2 focus:ring-[#2D3092]"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifyCadets}
                    onChange={(e) => setNotifyCadets(e.target.checked)}
                    className="w-4 h-4 text-[#EF1C25] border-gray-300 rounded focus:ring-[#EF1C25] cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-[#2D3092]" />
                    Send Push Notification alert to all unit cadets
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSessionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sessionSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#EF1C25] hover:bg-[#C7131B] text-white font-black text-xs shadow-md border-b-2 border-[#FFCB06] transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 fill-current text-[#FFCB06]" />
                  <span>{sessionSubmitting ? 'Activating...' : (sessionStatus?.is_active ? 'Save Changes' : 'Confirm & Activate')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TodayRoaster;
