import { PropertyDetails } from '../../types';
import { TN_MASTER_DATA } from '../../utils/dummyData';
import { AlertTriangle } from 'lucide-react';
import { isRegistrationDistrictCompatible } from '../../utils/geoUtils';

interface Step3PropertyProps {
  property: PropertyDetails;
  onChange: (property: PropertyDetails) => void;
  errors?: Record<string, string>;
}

const LEGACY_DISTRICTS = {
  'Vellore': {
    newDistricts: ['Tirupattur', 'Ranipet', 'Vellore'],
    effectiveDate: '2019-11-22',
    notes: 'Tirupattur and Ranipet districts were carved out of Vellore.'
  },
  'Kanchipuram': {
    newDistricts: ['Chengalpattu', 'Kanchipuram'],
    effectiveDate: '2019-11-29',
    notes: 'Chengalpattu district was carved out of Kanchipuram.'
  },
  'Viluppuram': {
    newDistricts: ['Kallakurichi', 'Viluppuram'],
    effectiveDate: '2019-11-26',
    notes: 'Kallakurichi district was carved out of Viluppuram.'
  },
  'Tirunelveli': {
    newDistricts: ['Tenkasi', 'Tirunelveli'],
    effectiveDate: '2019-11-22',
    notes: 'Tenkasi district was carved out of Tirunelveli.'
  },
  'Nagapattinam': {
    newDistricts: ['Mayiladuthurai', 'Nagapattinam'],
    effectiveDate: '2020-12-28',
    notes: 'Mayiladuthurai district was carved out of Nagapattinam.'
  }
};

export default function Step3Property({ property, onChange, errors }: Step3PropertyProps) {
  
  // Find current selected objects to derive cascading options
  const selectedDistrictObj = TN_MASTER_DATA.districtMaster.find(d => d.nameEn === property.district);
  const filteredTaluks = selectedDistrictObj
    ? TN_MASTER_DATA.talukMaster.filter(t => t.extra?.districtId === selectedDistrictObj.id)
    : [];

  const selectedTalukObj = filteredTaluks.find(t => t.nameEn === property.taluk);
  const filteredVillages = selectedTalukObj
    ? TN_MASTER_DATA.villageMaster.filter(v => v.extra?.talukId === selectedTalukObj.id)
    : [];

  const selectedRegDistrictObj = TN_MASTER_DATA.registrationDistrictMaster.find(rd => rd.nameEn === property.registrationDistrict);
  const filteredSros = selectedRegDistrictObj
    ? TN_MASTER_DATA.sroMaster.filter(s => s.extra?.registrationDistrictId === selectedRegDistrictObj.id)
    : [];

  const updateField = (field: keyof PropertyDetails, value: string) => {
    onChange({
      ...property,
      [field]: value
    });
  };

  const handleDistrictChange = (districtName: string) => {
    const isCompatible = isRegistrationDistrictCompatible(property.registrationDistrict, districtName);
    onChange({
      ...property,
      district: districtName,
      taluk: '',
      village: '',
      registrationDistrict: isCompatible ? property.registrationDistrict : '',
      sro: isCompatible ? property.sro : ''
    });
  };

  const handleTalukChange = (talukName: string) => {
    onChange({
      ...property,
      taluk: talukName,
      village: ''
    });
  };

  const handleRegistrationDistrictChange = (regDistrictName: string) => {
    onChange({
      ...property,
      registrationDistrict: regDistrictName,
      sro: ''
    });
  };

  const legacyReorg = LEGACY_DISTRICTS[property.district as keyof typeof LEGACY_DISTRICTS];
  const sroMismatch = property.district && property.registrationDistrict && 
    !isRegistrationDistrictCompatible(property.registrationDistrict, property.district);

  return (
    <div className="space-y-4" id="step-3-property">
      <p className="text-xs text-slate-500 font-medium">
        Identify geographic and regional parameters of the land registry. These determine SRO jurisdiction and applicable registry guidelines.
      </p>

      {/* REVENUE VS REGISTRATION DISTRICTS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Revenue District <span className="text-rose-500 font-bold">*</span>
          </label>
          <select
            value={property.district}
            onChange={(e) => handleDistrictChange(e.target.value)}
            className={`w-full border rounded p-2.5 text-xs text-slate-800 font-bold bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
              errors?.['property.district'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          >
            <option value="">Select Revenue District</option>
            {TN_MASTER_DATA.districtMaster.map(d => (
              <option key={d.id} value={d.nameEn}>{d.nameEn}</option>
            ))}
          </select>
          {errors?.['property.district'] && (
            <span className="text-[9px] text-rose-500 block">{errors['property.district']}</span>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Registration District <span className="text-rose-500 font-bold">*</span>
          </label>
          <select
            value={property.registrationDistrict}
            onChange={(e) => handleRegistrationDistrictChange(e.target.value)}
            className={`w-full border rounded p-2.5 text-xs text-slate-800 font-bold bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
              errors?.['property.registrationDistrict'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          >
            <option value="">Select Registration District</option>
            {TN_MASTER_DATA.registrationDistrictMaster.map(rd => (
              <option key={rd.id} value={rd.nameEn}>{rd.nameEn}</option>
            ))}
          </select>
          {errors?.['property.registrationDistrict'] && (
            <span className="text-[9px] text-rose-500 block">{errors['property.registrationDistrict']}</span>
          )}
        </div>
      </div>

      {/* LEGACY REORGANIZATION WARNING ALERT */}
      {legacyReorg && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-lg text-xs leading-relaxed flex items-start gap-2.5 my-3 animate-fade-in" id="legacy-district-warning">
          <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-900">District Boundary Reorganization Alert</p>
            <p>
              This district boundary has changed after administrative reorganization (effective <strong>{legacyReorg.effectiveDate}</strong>). 
              {legacyReorg.notes}
            </p>
            <p className="font-semibold text-amber-950 mt-1">
              Verify correct current district and SRO. Property might now belong to: <strong>{legacyReorg.newDistricts.join(', ')}</strong>.
            </p>
          </div>
        </div>
      )}

      {/* CASCADING TALUK, VILLAGE, AND SRO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Taluk <span className="text-rose-500 font-bold">*</span>
          </label>
          <select
            value={property.taluk}
            onChange={(e) => handleTalukChange(e.target.value)}
            disabled={!property.district}
            className={`w-full border rounded p-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed ${
              errors?.['property.taluk'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          >
            <option value="">{property.district ? 'Select Taluk' : 'Select District First'}</option>
            {filteredTaluks.map(t => (
              <option key={t.id} value={t.nameEn}>{t.nameEn}</option>
            ))}
          </select>
          {errors?.['property.taluk'] && (
            <span className="text-[9px] text-rose-500 block">{errors['property.taluk']}</span>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Village <span className="text-rose-500 font-bold">*</span>
          </label>
          <select
            value={property.village}
            onChange={(e) => updateField('village', e.target.value)}
            disabled={!property.taluk}
            className={`w-full border rounded p-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed ${
              errors?.['property.village'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          >
            <option value="">{property.taluk ? 'Select Village' : 'Select Taluk First'}</option>
            {filteredVillages.map(v => (
              <option key={v.id} value={v.nameEn}>{v.nameEn}</option>
            ))}
          </select>
          {errors?.['property.village'] && (
            <span className="text-[9px] text-rose-500 block">{errors['property.village']}</span>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Sub-Registrar Office (SRO) <span className="text-rose-500 font-bold">*</span>
          </label>
          <select
            value={property.sro}
            onChange={(e) => updateField('sro', e.target.value)}
            disabled={!property.registrationDistrict}
            className={`w-full border rounded p-2.5 text-xs font-bold text-emerald-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed ${
              errors?.['property.sro'] || sroMismatch ? 'border-rose-400' : 'border-slate-250'
            }`}
          >
            <option value="">{property.registrationDistrict ? 'Select SRO' : 'Select Reg District First'}</option>
            {filteredSros.map(s => (
              <option key={s.id} value={s.nameEn}>{s.nameEn}</option>
            ))}
          </select>
          {errors?.['property.sro'] && (
            <span className="text-[9px] text-rose-500 block">{errors['property.sro']}</span>
          )}
          {sroMismatch && !errors?.['property.sro'] && (
            <div className="text-[9px] text-rose-500 mt-1 flex items-center gap-1 bg-rose-50 border border-rose-200 p-1.5 rounded" id="sro-mismatch-warning">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
              <span>Selected SRO does not match property jurisdiction. Please verify registration district and SRO.</span>
            </div>
          )}
        </div>
      </div>

      {/* WARD, BLOCK, DOOR NUMBER */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Ward
          </label>
          <input
            type="text"
            value={property.ward}
            onChange={(e) => updateField('ward', e.target.value)}
            placeholder="e.g. Ward No. 4"
            className="w-full border border-slate-250 rounded p-2 text-xs text-slate-800"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Block
          </label>
          <input
            type="text"
            value={property.block}
            onChange={(e) => updateField('block', e.target.value)}
            placeholder="e.g. Block 12"
            className="w-full border border-slate-250 rounded p-2 text-xs text-slate-800"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Door Number <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            type="text"
            value={property.doorNo || ''}
            onChange={(e) => updateField('doorNo', e.target.value)}
            placeholder="e.g. New No. 24, Old No. 12"
            className={`w-full border rounded p-2 text-xs text-slate-800 font-semibold ${
              errors?.['property.doorNo'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          />
          {errors?.['property.doorNo'] && (
            <span className="text-[9px] text-rose-500 block">{errors['property.doorNo']}</span>
          )}
        </div>
      </div>

      {/* PROPERTY TYPE */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase font-bold text-slate-500 block">
          Property Type <span className="text-rose-500 font-bold">*</span>
        </label>
        <select
          value={property.propertyType}
          onChange={(e) => updateField('propertyType', e.target.value)}
          className="w-full border border-slate-250 rounded p-2.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {TN_MASTER_DATA.propertyTypeMaster.map(pt => (
            <option key={pt.id} value={pt.nameEn}>{pt.nameEn}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
