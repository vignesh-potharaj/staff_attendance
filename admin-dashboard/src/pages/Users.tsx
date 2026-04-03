import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, User as UserIcon } from 'lucide-react';
import api from '../services/api';

interface User {
  id: number;
  name: string;
  employee_id: string;
  phone: string;
  role: string;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', employee_id: '', phone: '', role: 'STAFF', password: ''
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
    setFormData({
      name: user.name,
      employee_id: user.employee_id,
      phone: user.phone,
      role: user.role,
      password: ''
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

      // For new users, password is required
      if (!editingUser && !formData.password) {
        alert('Password is required for new users');
        return;
      }

      const payload: Record<string, string | number | null> = {
        ...formData
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
      setFormData({ name: '', employee_id: '', phone: '', role: 'STAFF', password: '' });
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
            setFormData({ name: '', employee_id: '', phone: '', role: 'STAFF', password: '' });
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
          {users.map((user) => (
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
          ))}
          
          {users.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              <UserIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No users found. Create your first user!</p>
            </div>
          )}
        </div>
      </div>
      {/* Basic Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
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
