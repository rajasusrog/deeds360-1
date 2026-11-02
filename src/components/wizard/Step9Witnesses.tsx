import { useState } from 'react';
import { Plus, Trash, Users } from 'lucide-react';
import { WitnessDetails } from '../../types';

interface Step9WitnessesProps {
  witnesses: WitnessDetails[];
  onChange: (witnesses: WitnessDetails[]) => void;
  errors?: Record<string, string>;
}

export default function Step9Witnesses({ witnesses, onChange, errors }: Step9WitnessesProps) {
  const [phoneErrors, setPhoneErrors] = useState<Record<number, string>>({});

  const handlePhoneBlur = (idx: number, val: string) => {
    if (val && !/^[6-9][0-9]{9}$/.test(val)) {
      setPhoneErrors(prev => ({ ...prev, [idx]: 'Mobile number must contain exactly 10 digits and start with 6, 7, 8, or 9.' }));
    } else {
      setPhoneErrors(prev => {
        const copy = { ...prev };
        delete copy[idx];
        return copy;
      });
    }
  };
  
  const updateWitnessField = (index: number, field: keyof WitnessDetails, value: any) => {
    const updated = [...witnesses];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addWitness = () => {
    const newWitness: WitnessDetails = {
      id: Math.random().toString(36).substring(2, 11),
      name: '',
      fatherName: '',
      age: 30,
      aadhaar: '',
      address: '',
      phone: '',
      occupation: '',
      idProof: ''
    };
    onChange([...witnesses, newWitness]);
  };

  const removeWitness = (index: number) => {
    if (witnesses.length <= 2) {
      alert("At least 2 signing witnesses are mandatory for Tamil Nadu sub-registrar compliance!");
      return;
    }
    const updated = witnesses.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-4" id="step-9-witnesses">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 font-medium">
          Provide profile details for witnesses. A minimum of <strong className="text-slate-700">two</strong> signing witnesses are required by registration law.
        </p>
        <button
          onClick={addWitness}
          className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded border border-emerald-200 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Witness</span>
        </button>
      </div>

      <div className="space-y-4">
        {witnesses.map((witness, idx) => (
          <div key={witness.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-slate-500" />
                <span>Witness #{idx + 1} Profile</span>
              </span>
              
              <button
                onClick={() => removeWitness(idx)}
                className="p-1 text-slate-400 hover:text-rose-500 rounded transition"
                title="Remove witness"
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Witness Name <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={witness.name}
                  onChange={(e) => updateWitnessField(idx, 'name', e.target.value)}
                  placeholder="e.g. Mr. S. Anand"
                  className={`w-full border rounded p-2 text-xs font-semibold text-slate-800 bg-white ${
                    errors?.[`witnesses.${idx}.name`] ? 'border-rose-400' : 'border-slate-250'
                  }`}
                />
                {errors?.[`witnesses.${idx}.name`] && (
                  <span className="text-[9px] text-rose-500 block">{errors[`witnesses.${idx}.name`]}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Father Name <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={witness.fatherName}
                  onChange={(e) => updateWitnessField(idx, 'fatherName', e.target.value)}
                  placeholder="Father's Name"
                  className={`w-full border rounded p-2 text-xs text-slate-800 bg-white ${
                    errors?.[`witnesses.${idx}.fatherName`] ? 'border-rose-400' : 'border-slate-250'
                  }`}
                />
                {errors?.[`witnesses.${idx}.fatherName`] && (
                  <span className="text-[9px] text-rose-500 block">{errors[`witnesses.${idx}.fatherName`]}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Age <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="number"
                  value={witness.age || ''}
                  onChange={(e) => updateWitnessField(idx, 'age', parseInt(e.target.value) || 0)}
                  placeholder="Age"
                  className={`w-full border rounded p-2 text-xs text-slate-800 bg-white ${
                    errors?.[`witnesses.${idx}.age`] ? 'border-rose-400' : 'border-slate-250'
                  }`}
                />
                {errors?.[`witnesses.${idx}.age`] && (
                  <span className="text-[9px] text-rose-500 block">{errors[`witnesses.${idx}.age`]}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Occupation <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={witness.occupation || ''}
                  onChange={(e) => updateWitnessField(idx, 'occupation', e.target.value)}
                  placeholder="e.g. Retired officer"
                  className={`w-full border rounded p-2 text-xs text-slate-800 bg-white ${
                    errors?.[`witnesses.${idx}.occupation`] ? 'border-rose-400' : 'border-slate-250'
                  }`}
                />
                {errors?.[`witnesses.${idx}.occupation`] && (
                  <span className="text-[9px] text-rose-500 block">{errors[`witnesses.${idx}.occupation`]}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  ID Proof (e.g. Aadhaar / Voter ID) <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={witness.idProof || witness.aadhaar || ''}
                  onChange={(e) => {
                    updateWitnessField(idx, 'idProof', e.target.value);
                    updateWitnessField(idx, 'aadhaar', e.target.value);
                  }}
                  placeholder="Aadhaar / Voter ID number"
                  className={`w-full border rounded p-2 text-xs font-mono text-slate-800 bg-white ${
                    errors?.[`witnesses.${idx}.idProof`] ? 'border-rose-400' : 'border-slate-250'
                  }`}
                />
                {errors?.[`witnesses.${idx}.idProof`] && (
                  <span className="text-[9px] text-rose-500 block">{errors[`witnesses.${idx}.idProof`]}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Mobile / Phone
                </label>
                <input
                  type="tel"
                  value={witness.phone}
                  onChange={(e) => {
                    const sanitized = e.target.value.replace(/\D/g, '').slice(0, 10);
                    updateWitnessField(idx, 'phone', sanitized);
                    if (!sanitized || (sanitized.length === 10 && /^[6-9]/.test(sanitized))) {
                      setPhoneErrors(prev => {
                        const copy = { ...prev };
                        delete copy[idx];
                        return copy;
                      });
                    }
                  }}
                  onBlur={() => handlePhoneBlur(idx, witness.phone)}
                  placeholder="e.g. 9840112233"
                  maxLength={10}
                  className={`w-full border rounded p-2 text-xs text-slate-800 bg-white ${
                    (phoneErrors[idx] || errors?.[`witnesses.${idx}.phone`]) ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-250'
                  }`}
                />
                {(phoneErrors[idx] || errors?.[`witnesses.${idx}.phone`]) && (
                  <span className="text-[9px] text-rose-500 block">{phoneErrors[idx] || errors?.[`witnesses.${idx}.phone`]}</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 block">
                Witness Full Address <span className="text-rose-500 font-bold">*</span>
              </label>
              <textarea
                value={witness.address}
                onChange={(e) => updateWitnessField(idx, 'address', e.target.value)}
                placeholder="Residential Address"
                rows={1.5}
                className={`w-full border rounded p-2 text-xs text-slate-800 bg-white ${
                  errors?.[`witnesses.${idx}.address`] ? 'border-rose-400' : 'border-slate-250'
                }`}
              />
              {errors?.[`witnesses.${idx}.address`] && (
                <span className="text-[9px] text-rose-500 block">{errors[`witnesses.${idx}.address`]}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
