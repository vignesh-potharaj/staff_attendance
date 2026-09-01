import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, User as UserIcon, Clock, Calendar } from 'lucide-react';
import api from '../services/api';

interface User {
  id: number;
  name: string;
  employee_id: string;
  phone: string;
  role: string;
  hourly_pay: number;
  daily_pay?: number;
  pay_type?: 'hourly' | 'daily';
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    employee_id: '',
    phone: '',
    role: 'STAFF',
    password: '',
    pay_type: 'hourly' as 'hourly' | 'daily',
    hourly_pay: '0',
    daily_pay: '0'
  });

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users/');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    const hourly = user.hourly_pay || 0;
    const daily = user.daily_pay !== undefined ? user.daily_pay : hourly * 8;
    setFormData({
      name: user.name,
      employee_id: user.employee_id,
      phone: user.phone,
      role: user.role,
      password: '',
      pay_type: user.pay_type || 'hourly',
      hourly_pay: String(hourly),
      daily_pay: String(daily)
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
    } catch {
      alert('Failed to delete user');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate required fields
      if (!formData.name || !formData.employee_id || !formData.phone) {
        alert('Please fill in all required fields');
        return;
      }

      let hourlyPay = Number(formData.hourly_pay);
      let dailyPay = Number(formData.daily_pay);

      if (Number.isNaN(hourlyPay) || hourlyPay < 0) {
        alert('Please enter a valid hourly pay amount');
        return;
      }
      if (Number.isNaN(dailyPay) || dailyPay < 0) {
        alert('Please enter a valid daily pay amount');
        return;
      }

      // Auto compute counterpart if 0
      if (formData.pay_type === 'daily' && (hourlyPay === 0 || Number.isNaN(hourlyPay))) {
        hourlyPay = dailyPay / 8;
      } else if (formData.pay_type === 'hourly' && (dailyPay === 0 || Number.isNaN(dailyPay))) {
        dailyPay = hourlyPay * 8;
      }

      // For new users, password is required
      if (!editingUser && !formData.password) {
        alert('Password is required for new users');
        return;
      }

      const payload: Record<string, string | number | null> = {
        ...formData,
        hourly_pay: hourlyPay,
        daily_pay: dailyPay,
        pay_type: formData.pay_type
      };

      if (editingUser) {
        // For existing users, only delete password if not provided
        if (!payload.password) delete payload.password;
        await api.put(`/users/${editingUser.id}`, payload);
      } else {
        await api.post('/users/', payload);
      }

      setShowModal(false);
      setEditingUser(null);
      setFormData({
        name: '',
        employee_id: '',
        phone: '',
        role: 'STAFF',
        password: '',
        pay_type: 'hourly',
        hourly_pay: '0',
        daily_pay: '0'
      });
      fetchUsers();
    } catch {
      alert(editingUser ? 'Failed to update user' : 'Failed to create user');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">User Management</h2>
        <button
          onClick={() => {
            setEditingUser(null);
            setFormData({
              name: '',
              employee_id: '',
              phone: '',
              role: 'STAFF',
              password: '',
              pay_type: 'hourly',
              hourly_pay: '0',
              daily_pay: '0'
            });
            setShowModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-4">
        <div className="space-y-3">
          {users.map((user) => {
            const isDaily = user.pay_type === 'daily';
            const rate = isDaily 
              ? (user.daily_pay !== undefined && user.daily_pay > 0 ? user.daily_pay : (user.hourly_pay || 0) * 8)
              : (user.hourly_pay || 0);

            return (
              <div 
                key={user.id}
                className="relative rounded-xl border border-indigo-100 bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-300 overflow-hidden p-4 sm:p-5"
              >
                {/* Timeline top border */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-400 to-blue-600" />

                {/* Card content - vertical layout */}
                <div className="space-y-3">
                  {/* Header: Avatar + Name + ID + Role */}
                  <div className="flex items-start gap-3 justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center shadow-md text-white font-bold text-lg">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900">
                          {user.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          ID: {user.employee_id}
                        </p>
                      </div>
                    </div>

                    {/* Role Badge */}
                    <span className={`px-3 py-1.5 inline-flex text-xs leading-5 font-semibold rounded-full flex-shrink-0 ${
                      user.role === 'ADMIN' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {user.role}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 font-medium mb-1 uppercase tracking-wide">Phone</p>
                    <p className="text-sm font-semibold text-slate-900">{user.phone}</p>
                  </div>

                  {/* Pay Rate & Pay Type Badge */}
                  <div className={`p-3 rounded-lg border ${
                    isDaily ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 ${
                        isDaily ? 'text-emerald-700' : 'text-blue-700'
                      }`}>
                        {isDaily ? <Calendar className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {isDaily ? 'Daily Pay (Day Rate)' : 'Hourly Pay'}
                      </p>
                      <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
                        isDaily 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                          : 'bg-blue-100 text-blue-800 border-blue-300'
                      }`}>
                        {isDaily ? 'Daily Mode' : 'Hourly Mode'}
                      </span>
                    </div>
                    <p className="text-base font-bold text-slate-900 mt-1">
                      ₹{Number(rate).toFixed(2)} 
                      <span className="text-xs font-normal text-slate-500 ml-1">
                        {isDaily ? '/ day' : '/ hr'}
                      </span>
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button 
                      onClick={() => handleEdit(user)} 
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    {user.employee_id !== 'admin' && (
                      <button 
                        onClick={() => handleDelete(user.id)} 
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {users.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              <UserIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No users found. Create your first user!</p>
            </div>
          )}
        </div>
      </div>
      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{editingUser ? 'Edit Employee' : 'Add New Employee'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input required type="text" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                <input 
                  required 
                  disabled={!!editingUser}
                  placeholder={editingUser ? "Cannot change ID" : ""}
                  type="text" 
                  className={`mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500 ${editingUser ? 'bg-gray-100' : ''}`} 
                  value={formData.employee_id} 
                  onChange={e => setFormData({...formData, employee_id: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password {editingUser && '(Leave blank to keep current)'}</label>
                <input 
                  required={!editingUser} 
                  type="password" 
                  minLength={6} 
                  className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" 
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                  <option value="STAFF">STAFF</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input required type="tel" className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 focus:ring-blue-500 focus:border-blue-500" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>

              {/* Default Pay Type Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Pay Type</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      const hourly = Number(formData.hourly_pay) || (Number(formData.daily_pay) / 8) || 0;
                      setFormData({ ...formData, pay_type: 'hourly', hourly_pay: String(hourly) });
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-md transition-all ${
                      formData.pay_type === 'hourly'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Hourly Pay
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const daily = Number(formData.daily_pay) || (Number(formData.hourly_pay) * 8) || 0;
                      setFormData({ ...formData, pay_type: 'daily', daily_pay: String(daily) });
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-md transition-all ${
                      formData.pay_type === 'daily'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Daily Pay
                  </button>
                </div>
              </div>

              {/* Pay Rates Inputs */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase">Hourly Pay (₹)</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    className="mt-1 block w-full border border-gray-300 rounded-md py-1.5 px-2.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                    value={formData.hourly_pay}
                    onChange={e => {
                      const val = e.target.value;
                      const num = Number(val);
                      const daily = !Number.isNaN(num) && num > 0 ? String(num * 8) : formData.daily_pay;
                      setFormData({...formData, hourly_pay: val, daily_pay: daily});
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase">Daily Pay (₹)</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    className="mt-1 block w-full border border-gray-300 rounded-md py-1.5 px-2.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                    value={formData.daily_pay}
                    onChange={e => {
                      const val = e.target.value;
                      const num = Number(val);
                      const hourly = !Number.isNaN(num) && num > 0 ? String(num / 8) : formData.hourly_pay;
                      setFormData({...formData, daily_pay: val, hourly_pay: hourly});
                    }}
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  {editingUser ? 'Update User' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
