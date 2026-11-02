import { useState } from 'react';
import { Plus, Trash, Users } from 'lucide-react';
import { PartyDetails } from '../../types';
import { TN_MASTER_DATA } from '../../utils/dummyData';
import { useApp } from '../../context/AppContext';
import { resolveDeedType } from '../../utils/deedTypes';

interface Step2PartiesProps {
  parties: PartyDetails[];
  onChange: (parties: PartyDetails[]) => void;
  errors?: Record<string, string>;
  documentType?: string;
}

export default function Step2Parties({ parties, onChange, errors, documentType }: Step2PartiesProps) {
  const { clients, currentDraft } = useApp();
  const [phoneErrors, setPhoneErrors] = useState<Record<number, string>>({});

  const activeDocType = documentType || currentDraft?.state?.documentType || 'SALE';
  const deedDef = resolveDeedType(activeDocType);
  const defaultGrantorRole = deedDef?.grantorRole || 'Seller';
  const defaultGranteeRole = deedDef?.granteeRole || 'Buyer';

  const handlePhoneBlur = (idx: number, val: string) => {
    if (!val) {
      setPhoneErrors(prev => ({ ...prev, [idx]: 'Phone number is required' }));
    } else if (!/^[6-9][0-9]{9}$/.test(val)) {
      setPhoneErrors(prev => ({ ...prev, [idx]: 'Mobile number must contain exactly 10 digits and start with 6, 7, 8, or 9.' }));
    } else {
      setPhoneErrors(prev => {
        const copy = { ...prev };
        delete copy[idx];
        return copy;
      });
    }
  };
  
  const updatePartyField = (index: number, field: keyof PartyDetails, value: any) => {
    const updated = [...parties];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addParty = () => {
    const hasGrantor = parties.some(p => deedDef ? deedDef.acceptedGrantorRoles.includes(p.role) : p.role === 'Seller');
    const newParty: PartyDetails = {
      id: Math.random().toString(36).substring(2, 11),
      role: hasGrantor ? defaultGranteeRole : defaultGrantorRole,
      name: '',
      fatherName: '',
      age: 30,
      dob: '1996-01-01',
      occupation: 'Business',
      aadhaar: '',
      pan: '',
      phone: '',
      mobile: '',
      email: '',
      address: ''
    };
    onChange([...parties, newParty]);
  };

  const removeParty = (index: number) => {
    if (parties.length <= 1) {
      alert("At least one party is mandatory in the deed.");
      return;
    }
    const updated = parties.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  const loadClientProfile = (index: number, clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    const updated = [...parties];
    updated[index] = {
      ...updated[index],
      name: client.name,
      fatherName: client.fatherName,
      dob: client.dob,
      age: client.age,
      occupation: client.occupation,
      aadhaar: client.aadhaar,
      pan: client.pan,
      phone: client.phone,
      mobile: client.phone,
      email: client.email,
      address: client.address,
      clientId: client.id
    };
    onChange(updated);
  };

  return (
    <div className="space-y-5" id="step-2-parties">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 font-medium">
          Capture executing parties for <strong>{deedDef?.nameEn || 'Deed'}</strong> (Required roles: <strong>{defaultGrantorRole}</strong> and <strong>{defaultGranteeRole}</strong>).
        </p>
        <button
          onClick={addParty}
          className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded border border-emerald-200 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Party Profile</span>
        </button>
      </div>

      <div className="space-y-6">
        {parties.map((party, idx) => (
          <div key={party.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-slate-500" />
                <span>Party #{idx + 1} Profile</span>
              </span>
              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => loadClientProfile(idx, e.target.value)}
                  className="bg-white border border-slate-250 rounded px-2 py-1 text-[10px] font-bold text-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Autofill profile...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <button
                  onClick={() => removeParty(idx)}
                  className="p-1 text-slate-400 hover:text-rose-500 rounded transition"
                  title="Remove party"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Role <span className="text-rose-500 font-bold">*</span>
                </label>
                <select
                  value={party.role}
                  onChange={(e) => updatePartyField(idx, 'role', e.target.value)}
                  className="w-full bg-white border border-slate-250 rounded p-2 text-xs font-bold text-slate-700"
                >
                  <option value="Seller">Seller / Vendor (Sale Deed)</option>
                  <option value="Buyer">Buyer / Purchaser (Sale Deed)</option>
                  <option value="Settlor">Settlor (Settlement Deed)</option>
                  <option value="Settlee">Settlee / Beneficiary (Settlement Deed)</option>
                  <option value="Donor">Donor (Gift Deed)</option>
                  <option value="Donee">Donee (Gift Deed)</option>
                  <option value="First Co-owner">First Co-owner (Partition Deed)</option>
                  <option value="Second Co-owner">Second Co-owner (Partition Deed)</option>
                  <option value="Co-owner">Co-owner / Coparcener (Partition)</option>
                  <option value="Lessor">Lessor / Landlord (Lease Deed)</option>
                  <option value="Lessee">Lessee / Tenant (Lease Deed)</option>
                  <option value="Mortgagor">Mortgagor / Borrower (Mortgage Deed)</option>
                  <option value="Mortgagee">Mortgagee / Lender (Mortgage Deed)</option>
                  <option value="Principal">Principal / Executant (Power of Attorney)</option>
                  <option value="Power Agent">Power Agent / Attorney (POA)</option>
                  <option value="Witness">Witness</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Full Name <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={party.name}
                  onChange={(e) => updatePartyField(idx, 'name', e.target.value)}
                  className={`w-full bg-white border rounded p-2 text-xs font-semibold text-slate-800 ${
                    errors?.[`parties.${idx}.name`] ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-250'
                  }`}
                  placeholder="Mr. Rajesh Kumar"
                />
                {errors?.[`parties.${idx}.name`] && (
                  <span className="text-[9px] text-rose-500 block">{errors[`parties.${idx}.name`]}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Father / Husband Name <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={party.fatherName}
                  onChange={(e) => updatePartyField(idx, 'fatherName', e.target.value)}
                  className={`w-full bg-white border rounded p-2 text-xs text-slate-800 ${
                    errors?.[`parties.${idx}.fatherName`] ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-250'
                  }`}
                  placeholder="Father/Husband Name"
                />
                {errors?.[`parties.${idx}.fatherName`] && (
                  <span className="text-[9px] text-rose-500 block">{errors[`parties.${idx}.fatherName`]}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Age <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="number"
                  value={party.age || ''}
                  onChange={(e) => updatePartyField(idx, 'age', parseInt(e.target.value) || 0)}
                  className={`w-full bg-white border rounded p-2 text-xs text-slate-800 ${
                    errors?.[`parties.${idx}.age`] ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-250'
                  }`}
                  placeholder="Age"
                />
                {errors?.[`parties.${idx}.age`] && (
                  <span className="text-[9px] text-rose-500 block">{errors[`parties.${idx}.age`]}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Occupation <span className="text-rose-500 font-bold">*</span>
                </label>
                <select
                  value={party.occupation}
                  onChange={(e) => updatePartyField(idx, 'occupation', e.target.value)}
                  className="w-full bg-white border border-slate-250 rounded p-2 text-xs text-slate-800"
                >
                  {TN_MASTER_DATA.occupationMaster.map(o => (
                    <option key={o.id} value={o.nameEn}>{o.nameEn}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  PAN <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={party.pan}
                  onChange={(e) => updatePartyField(idx, 'pan', e.target.value.toUpperCase())}
                  placeholder="ABCPS1234F"
                  maxLength={10}
                  className={`w-full bg-white border rounded p-2 text-xs font-mono text-slate-800 ${
                    errors?.[`parties.${idx}.pan`] ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-250'
                  }`}
                />
                {errors?.[`parties.${idx}.pan`] && (
                  <span className="text-[9px] text-rose-500 block">{errors[`parties.${idx}.pan`]}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Aadhaar <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={party.aadhaar}
                  onChange={(e) => updatePartyField(idx, 'aadhaar', e.target.value)}
                  placeholder="1234-5678-9012"
                  maxLength={19}
                  className={`w-full bg-white border rounded p-2 text-xs font-mono text-slate-800 ${
                    errors?.[`parties.${idx}.aadhaar`] ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-250'
                  }`}
                />
                {errors?.[`parties.${idx}.aadhaar`] && (
                  <span className="text-[9px] text-rose-500 block">{errors[`parties.${idx}.aadhaar`]}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Mobile / Phone <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="tel"
                  value={party.phone}
                  onChange={(e) => {
                    const sanitized = e.target.value.replace(/\D/g, '').slice(0, 10);
                    updatePartyField(idx, 'phone', sanitized);
                    updatePartyField(idx, 'mobile', sanitized);
                    if (sanitized.length === 10 && /^[6-9]/.test(sanitized)) {
                      setPhoneErrors(prev => {
                        const copy = { ...prev };
                        delete copy[idx];
                        return copy;
                      });
                    }
                  }}
                  onBlur={() => handlePhoneBlur(idx, party.phone)}
                  placeholder="9840123456"
                  maxLength={10}
                  className={`w-full bg-white border rounded p-2 text-xs text-slate-800 ${
                    (phoneErrors[idx] || errors?.[`parties.${idx}.phone`]) ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-250'
                  }`}
                />
                {(phoneErrors[idx] || errors?.[`parties.${idx}.phone`]) && (
                  <span className="text-[9px] text-rose-500 block">{phoneErrors[idx] || errors?.[`parties.${idx}.phone`]}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Email
                </label>
                <input
                  type="email"
                  value={party.email}
                  onChange={(e) => updatePartyField(idx, 'email', e.target.value)}
                  placeholder="email@example.com"
                  className="w-full bg-white border border-slate-250 rounded p-2 text-xs text-slate-800"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 block">
                Complete Address <span className="text-rose-500 font-bold">*</span>
              </label>
              <textarea
                value={party.address}
                onChange={(e) => updatePartyField(idx, 'address', e.target.value)}
                placeholder="Door No, Street Name, City, Pincode"
                rows={2}
                className={`w-full bg-white border rounded p-2 text-xs text-slate-800 ${
                  errors?.[`parties.${idx}.address`] ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-250'
                }`}
              />
              {errors?.[`parties.${idx}.address`] && (
                <span className="text-[9px] text-rose-500 block">{errors[`parties.${idx}.address`]}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
