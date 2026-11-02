import { BoundaryDetails } from '../../types';

interface Step6BoundaryProps {
  boundary: BoundaryDetails;
  onChange: (boundary: BoundaryDetails) => void;
  errors?: Record<string, string>;
}

export default function Step6Boundary({ boundary, onChange, errors }: Step6BoundaryProps) {
  
  const updateField = (field: keyof BoundaryDetails, value: string) => {
    onChange({
      ...boundary,
      [field]: value
    });
  };

  return (
    <div className="space-y-4" id="step-6-boundary">
      <p className="text-xs text-slate-500 font-medium">
        Establish precise boundaries for the property. These bounds physical boundaries are printed in the schedule of the deed.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            East Boundary <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            type="text"
            value={boundary.east}
            onChange={(e) => updateField('east', e.target.value)}
            placeholder="e.g. 30 Feet wide Municipal Road"
            className={`w-full border rounded p-2 text-xs text-slate-800 ${
              errors?.['boundary.east'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          />
          {errors?.['boundary.east'] && (
            <span className="text-[9px] text-rose-500 block">{errors['boundary.east']}</span>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            West Boundary <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            type="text"
            value={boundary.west}
            onChange={(e) => updateField('west', e.target.value)}
            placeholder="e.g. Plot No. 15 belonging to Raghavan"
            className={`w-full border rounded p-2 text-xs text-slate-800 ${
              errors?.['boundary.west'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          />
          {errors?.['boundary.west'] && (
            <span className="text-[9px] text-rose-500 block">{errors['boundary.west']}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            North Boundary <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            type="text"
            value={boundary.north}
            onChange={(e) => updateField('north', e.target.value)}
            placeholder="e.g. Plot No. 12 belonging to Kumar"
            className={`w-full border rounded p-2 text-xs text-slate-800 ${
              errors?.['boundary.north'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          />
          {errors?.['boundary.north'] && (
            <span className="text-[9px] text-rose-500 block">{errors['boundary.north']}</span>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500 block">
            South Boundary <span className="text-rose-500 font-bold">*</span>
          </label>
          <input
            type="text"
            value={boundary.south}
            onChange={(e) => updateField('south', e.target.value)}
            placeholder="e.g. Open Municipal Lane"
            className={`w-full border rounded p-2 text-xs text-slate-800 ${
              errors?.['boundary.south'] ? 'border-rose-400' : 'border-slate-250'
            }`}
          />
          {errors?.['boundary.south'] && (
            <span className="text-[9px] text-rose-500 block">{errors['boundary.south']}</span>
          )}
        </div>
      </div>
    </div>
  );
}
