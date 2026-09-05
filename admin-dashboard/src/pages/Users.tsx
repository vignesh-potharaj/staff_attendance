import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, User as UserIcon } from 'lucide-react';
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
        <div>
          <h2 className="text-xl font-black text-[#2D3092] uppercase tracking-tight">Cadet & Instructor Management</h2>
          <p className="text-xs text-slate-500 font-medium">Manage battalion profiles and accounts</p>
        </div>
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
          className="bg-[#EF1C25] hover:bg-[#C7131B] text-white font-bold px-4 py-2.5 rounded-xl shadow-md flex items-center space-x-2 border-b-2 border-[#FFCB06] transition-all text-sm"
        >
          <Plus className="w-4 h-4 text-[#FFCB06]" />
          <span>Add Cadet / User</span>
        </button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-4">
        <div className="space-y-3">
          {users.map((user) => {
            return (
              <div 
                key={user.id}
                className="relative rounded-xl border border-slate-200 bg-white hover:border-[#00AEEF] hover:shadow-md transition-all duration-300 overflow-hidden p-4 sm:p-5"
              >
                {/* NCC Tri-Color Top Accent Line */}
                <div className="ncc-tricolor-bar absolute top-0 left-0 right-0">
                  <div className="stripe-red" />
                  <div className="stripe-navy" />
                  <div className="stripe-skyblue" />
                </div>

                {/* Card content - vertical layout */}
                <div className="space-y-3 pt-2">
                  {/* Header: Avatar + Name + ID + Role */}
                  <div className="flex items-start gap-3 justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-[#2D3092] to-[#00AEEF] border-2 border-[#FFCB06] flex items-center justify-center shadow-md text-white font-black text-lg">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-lg font-black text-[#2D3092]">
                          {user.name}
                        </h3>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">
                          Cadet/User ID: <span className="text-[#EF1C25] font-black">{user.employee_id}</span>
                        </p>
                      </div>
                    </div>

                    {/* Role Badge */}
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-black rounded-full flex-shrink-0 border ${
                      user.role === 'ADMIN' 
                        ? 'bg-[#2D3092] text-white border-[#FFCB06]' 
                        : 'bg-[#00AEEF]/10 text-[#00AEEF] border-[#00AEEF]/40'
                    }`}>
                      {user.role === 'ADMIN' ? 'INSTRUCTOR (ADMIN)' : 'CADET (STAFF)'}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold mb-0.5 uppercase tracking-wide">Phone Number</p>
                    <p className="text-sm font-bold text-slate-900">{user.phone}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button 
                      onClick={() => handleEdit(user)} 
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-[#2D3092] hover:bg-[#2D3092]/10 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    {user.employee_id !== 'admin' && (
                      <button 
                        onClick={() => handleDelete(user.id)} 
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-[#EF1C25] hover:bg-[#EF1C25]/10 rounded-lg transition-colors"
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
