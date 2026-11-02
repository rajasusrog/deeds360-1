import { useState, FormEvent, ChangeEvent } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  UserCheck, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  CreditCard,
  Briefcase,
  Cake,
  Calendar,
  X
} from 'lucide-react';
import { ClientProfile } from '../types';
import { useApp } from '../context/AppContext';

export default function ClientManagement() {
  const { clients, addClient, currentUser } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [saveError, setSaveError] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    dob: '',
    age: '',
    occupation: 'Private Service',
    pan: '',
    aadhaar: '',
    address: '',
    phone: '',
    email: ''
  });

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      const sanitized = value.replace(/\D/g, '').slice(0, 10);
      setFormData(prev => ({ ...prev, [name]: sanitized }));
      if (sanitized.length === 10 && /^[6-9]/.test(sanitized)) {
        setPhoneError('');
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePhoneBlur = () => {
    const val = formData.phone;
    if (!val) {
      setPhoneError('Phone number is required');
    } else if (!/^[6-9][0-9]{9}$/.test(val)) {
      setPhoneError('Mobile number must contain exactly 10 digits and start with 6, 7, 8, or 9.');
    } else {
      setPhoneError('');
    }
  };

  const handleCreateClient = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError('');
    if (!formData.name || !formData.phone || !formData.aadhaar) {
      alert("Name, Phone number, and Aadhaar card are mandatory for Deed360 registration!");
      return;
    }
    
    if (!/^[6-9][0-9]{9}$/.test(formData.phone)) {
      setPhoneError('Mobile number must contain exactly 10 digits and start with 6, 7, 8, or 9.');
      alert('Mobile number must contain exactly 10 digits and start with 6, 7, 8, or 9.');
      return;
    }

    const newClient: ClientProfile = {
      id: 'c_' + Math.random().toString(36).slice(2, 11),
      name: formData.name,
      fatherName: formData.fatherName,
      dob: formData.dob || '1980-01-01',
      age: parseInt(formData.age) || 45,
      occupation: formData.occupation,
      pan: formData.pan.toUpperCase(),
      aadhaar: formData.aadhaar,
      address: formData.address,
      phone: formData.phone,
      email: formData.email,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.email,
      createdByUserId: currentUser?.id,
      createdByEmail: currentUser?.email
    };

    try {
      await addClient(newClient);
      setShowAddModal(false);
      setFormData({
        name: '',
        fatherName: '',
        dob: '',
        age: '',
        occupation: 'Private Service',
        pan: '',
        aadhaar: '',
        address: '',
        phone: '',
        email: ''
      });
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save client profile.');
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery) || 
    c.aadhaar.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 text-left">
        <div>
          <h3 className="text-md font-bold text-slate-800">Client Profiles Directory</h3>
          <p className="text-xs text-slate-400">Add and reuse verified Tamil Nadu buyer and seller profiles for deed drafting</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-[#c49a36] hover:bg-[#b58a2b] font-bold text-xs text-white rounded-lg transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add Client Profile</span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative text-left">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          id="client-search"
          type="text"
          placeholder="Search by name, Aadhaar card number, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      {/* Grid of Clients */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 text-left">
        {filteredClients.map((client) => (
          <div key={client.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-emerald-500/30 hover:shadow-md transition duration-150 flex flex-col gap-4 relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-extrabold border border-slate-200">
                  {client.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800">{client.name}</h4>
                  <p className="text-[10px] text-slate-400 font-medium">S/o, W/o {client.fatherName}</p>
                </div>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-slate-50 border border-slate-200 text-slate-500 font-mono">
                ID: {client.id}
              </span>
            </div>

            {/* Demographics details */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-b border-slate-100 py-3 text-[11px] font-medium text-slate-600">
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Job: <strong className="text-slate-800">{client.occupation}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Cake className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Age: <strong className="text-slate-800">{client.age} yrs</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Phone: <strong className="text-slate-800">{client.phone}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">Email: <strong className="text-slate-800">{client.email || '—'}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Aadhaar: <strong className="text-slate-800 font-mono">{client.aadhaar}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>PAN: <strong className="text-slate-800 font-mono">{client.pan || '—'}</strong></span>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-2 text-[11px] text-slate-500 leading-normal">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>Address: <strong className="text-slate-700">{client.address}</strong></span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Client Profile Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col text-left animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800">Add Client profile</span>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-slate-200 rounded-full transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="p-5 space-y-4 overflow-y-auto max-h-[500px]">
              {saveError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold text-rose-700">
                  {saveError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="M. Selvakumar"
                    className="w-full border border-slate-250 rounded p-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Father/Husband Name</label>
                  <input
                    type="text"
                    name="fatherName"
                    required
                    value={formData.fatherName}
                    onChange={handleInputChange}
                    placeholder="Muthuswamy Mudaliar"
                    className="w-full border border-slate-250 rounded p-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">DOB</label>
                  <input
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={handleInputChange}
                    className="w-full border border-slate-250 rounded p-1.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Age</label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    placeholder="45"
                    className="w-full border border-slate-250 rounded p-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Occupation</label>
                  <select
                    name="occupation"
                    value={formData.occupation}
                    onChange={handleInputChange}
                    className="w-full border border-slate-250 rounded p-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option>Agriculture</option>
                    <option>Business</option>
                    <option>Private Service</option>
                    <option>Government Service</option>
                    <option>Homemaker</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Aadhaar (12 digits)</label>
                  <input
                    type="text"
                    name="aadhaar"
                    required
                    pattern="[0-9]{4}-[0-9]{4}-[0-9]{4}"
                    value={formData.aadhaar}
                    onChange={handleInputChange}
                    placeholder="1234-5678-9012"
                    className="w-full border border-slate-250 rounded p-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">PAN Card</label>
                  <input
                    type="text"
                    name="pan"
                    value={formData.pan}
                    onChange={handleInputChange}
                    placeholder="ABCPS1234F"
                    className="w-full border border-slate-250 rounded p-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    maxLength={10}
                    value={formData.phone}
                    onChange={handleInputChange}
                    onBlur={handlePhoneBlur}
                    placeholder="9840123456"
                    className={`w-full border rounded p-2 text-xs focus:ring-1 focus:outline-none ${
                      phoneError ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-250 focus:ring-emerald-500'
                    }`}
                  />
                  {phoneError && (
                    <span className="text-[9px] text-rose-500 block">{phoneError}</span>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="client@example.com"
                    className="w-full border border-slate-250 rounded p-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500">Full Postal Address</label>
                <textarea
                  name="address"
                  required
                  rows={3}
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Complete door numbers, street, village and pincodes..."
                  className="w-full border border-slate-250 rounded p-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-250 rounded text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#c49a36] hover:bg-[#b58a2b] text-xs font-bold text-white rounded transition shadow"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
