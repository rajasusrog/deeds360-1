import { ExtentDetails } from '../../types';

interface Step5MeasurementProps {
  extent: ExtentDetails;
  onChange: (extent: ExtentDetails) => void;
  errors?: Record<string, string>;
}

const AREA_UNITS = ['Sq.ft', 'Cent', 'Acre', 'Ground', 'Sq.m', 'Hectare'] as const;

export default function Step5Measurement({ extent, onChange, errors }: Step5MeasurementProps) {
  
  const updateField = (field: keyof ExtentDetails, value: any) => {
    const updated = { ...extent, [field]: value };
    
    // Sync to legacy extent fields if possible to avoid breaking other views
    if (field === 'totalExtent' || field === 'areaUnit') {
      const numVal = parseFloat(value) || 0;
      const unit = field === 'areaUnit' ? value : extent.areaUnit;
      
      if (unit === 'Sq.ft') updated.sqft = numVal;
      else if (unit === 'Cent') updated.cent = numVal;
      else if (unit === 'Acre') updated.acre = numVal;
      else if (unit === 'Hectare') updated.hectare = numVal;
    }
    
    onChange(updated);
  };

  return (
    <div className="space-y-4" id="step-5-measurement">
      <p className="text-xs text-slate-500 font-medium">
        Define precise layout dimensions, undivided share of land (UDS), and structural built-up details.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Area Measurement Unit <span className="text-rose-500 font-bold">*</span>
          </label>
          <select
            value={extent.areaUnit || 'Sq.ft'}
            onChange={(e) => updateField('areaUnit', e.target.value)}
            className="w-full border border-slate-250 rounded p-2 text-xs text-slate-800 bg-white focus:outline-none font-bold"
          >
            {AREA_UNITS.map(unit => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Total Extent <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            type="number"
            value={extent.totalExtent || ''}
            onChange={(e) => updateField('totalExtent', parseFloat(e.target.value) || 0)}
            placeholder="e.g. 2400"
            className={`w-full border rounded p-2 text-xs font-bold text-slate-800 ${
              errors?.['extent.totalExtent'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          />
          {errors?.['extent.totalExtent'] && (
            <span className="text-[9px] text-rose-500 block">{errors['extent.totalExtent']}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            East-West Measurement <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            type="text"
            value={extent.eastWest || ''}
            onChange={(e) => updateField('eastWest', e.target.value)}
            placeholder="e.g. 40 Feet"
            className={`w-full border rounded p-2 text-xs text-slate-800 ${
              errors?.['extent.eastWest'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          />
          {errors?.['extent.eastWest'] && (
            <span className="text-[9px] text-rose-500 block">{errors['extent.eastWest']}</span>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            North-South Measurement <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            type="text"
            value={extent.northSouth || ''}
            onChange={(e) => updateField('northSouth', e.target.value)}
            placeholder="e.g. 60 Feet"
            className={`w-full border rounded p-2 text-xs text-slate-800 ${
              errors?.['extent.northSouth'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          />
          {errors?.['extent.northSouth'] && (
            <span className="text-[9px] text-rose-500 block">{errors['extent.northSouth']}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Built-up Area (Sq.ft)
          </label>
          <input
            type="number"
            value={extent.builtUpArea || ''}
            onChange={(e) => updateField('builtUpArea', parseFloat(e.target.value) || 0)}
            placeholder="e.g. 1800 (Leave 0 if vacant plot)"
            className="w-full border border-slate-250 rounded p-2 text-xs text-slate-800"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            Undivided Share - UDS (Sq.ft)
          </label>
          <input
            type="number"
            value={extent.uds || ''}
            onChange={(e) => updateField('uds', parseFloat(e.target.value) || 0)}
            placeholder="e.g. 450 (Applicable for apartments)"
            className="w-full border border-slate-250 rounded p-2 text-xs text-slate-800"
          />
        </div>
      </div>
    </div>
  );
}
