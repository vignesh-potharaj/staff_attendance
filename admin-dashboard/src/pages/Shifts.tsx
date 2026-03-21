import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../services/api';

interface Shift {
  id: number;
  shift_name: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
}

const Shifts: React.FC = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState({
    shift_name: '', start_time: '09:00', end_time: '17:00', grace_period_minutes: 15
  });

  const fetchShifts = async () => {
    try {
      const res = await api.get('/shifts/');
      setShifts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchShifts(); }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this shift?')) return;
    try {
      await api.delete(`/shifts/${id}`);
      fetchShifts();
    } catch {
      alert('Failed to delete shift. Make sure no users are assigned to it first.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Must pad time with seconds for Time schema
      const payload = {
        shift_name: formData.shift_name,
        start_time: `${formData.start_time}:00`,
        end_time: `${formData.end_time}:00`,
        grace_period_minutes: Number(formData.grace_period_minutes)
      };
      await api.post('/shifts/', payload);
      setShowModal(false);
      setFormData({ shift_name: '', start_time: '09:00', end_time: '17:00', grace_period_minutes: 15 });
      fetchShifts();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || 'Failed to create shift');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Shift Management</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Shift</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grace Period</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {shifts.map((shift) => (
              <tr key={shift.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-medium text-gray-900">{shift.shift_name}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {shift.start_time}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {shift.end_time}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {shift.grace_period_minutes} min
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleDelete(shift.id)} className="text-red-600 hover:text-red-900 ml-4">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
             {shifts.length === 0 && !loading && (
               <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No shifts defined yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

       {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Add New Shift</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Shift Name</label>
                <input required type="text" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" value={formData.shift_name} onChange={e => setFormData({...formData, shift_name: e.target.value})} placeholder="e.g. Morning Shift" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Time</label>
                  <input required type="time" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Time</label>
                  <input required type="time" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Grace Period (Minutes)</label>
                <input required type="number" min={0} max={120} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" value={formData.grace_period_minutes} onChange={e => setFormData({...formData, grace_period_minutes: parseInt(e.target.value)})} />
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save Shift</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shifts;
