import { Plus, Trash, Navigation } from 'lucide-react';
import { SurveyDetails } from '../../types';

interface Step4SurveyProps {
  surveys: SurveyDetails[];
  onChange: (surveys: SurveyDetails[]) => void;
  errors?: Record<string, string>;
}

export default function Step4Survey({ surveys, onChange, errors }: Step4SurveyProps) {
  
  const updateSurveyField = (index: number, field: keyof SurveyDetails, value: string) => {
    const updated = [...surveys];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addSurvey = () => {
    const newSurvey: SurveyDetails = {
      id: Math.random().toString(36).substring(2, 11),
      surveyNo: '',
      subDivision: '',
      pattaNo: '',
      tslrNo: '',
      chittaRef: ''
    };
    onChange([...surveys, newSurvey]);
  };

  const removeSurvey = (index: number) => {
    if (surveys.length <= 1) {
      alert("At least one Survey record is mandatory for registration.");
      return;
    }
    const updated = surveys.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-4" id="step-4-survey">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 font-medium">
          Specify Survey records. Support multiple survey entries for multi-plot conveyances. <span className="text-rose-500 font-bold">*</span>
        </p>
        <button
          onClick={addSurvey}
          className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded border border-emerald-200 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Survey Record</span>
        </button>
      </div>

      <div className="space-y-4">
        {surveys.map((survey, idx) => (
          <div key={survey.id || idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4 relative">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <Navigation className="h-4 w-4 text-slate-500" />
                <span>Survey Record #{idx + 1}</span>
              </span>
              
              <button
                onClick={() => removeSurvey(idx)}
                className="p-1 text-slate-400 hover:text-rose-500 rounded transition"
                title="Remove survey"
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Survey Number <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={survey.surveyNo}
                  onChange={(e) => updateSurveyField(idx, 'surveyNo', e.target.value)}
                  placeholder="e.g. 142"
                  className={`w-full border rounded p-2 text-xs font-bold text-slate-800 ${
                    errors?.[`surveys.${idx}.surveyNo`] ? 'border-rose-400' : 'border-slate-250'
                  }`}
                />
                {errors?.[`surveys.${idx}.surveyNo`] && (
                  <span className="text-[9px] text-rose-500 block">{errors[`surveys.${idx}.surveyNo`]}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Subdivision Number <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={survey.subDivision}
                  onChange={(e) => updateSurveyField(idx, 'subDivision', e.target.value)}
                  placeholder="e.g. 3A"
                  className={`w-full border rounded p-2 text-xs font-bold text-slate-800 ${
                    errors?.[`surveys.${idx}.subDivision`] ? 'border-rose-400' : 'border-slate-250'
                  }`}
                />
                {errors?.[`surveys.${idx}.subDivision`] && (
                  <span className="text-[9px] text-rose-500 block">{errors[`surveys.${idx}.subDivision`]}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Patta Number <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={survey.pattaNo}
                  onChange={(e) => updateSurveyField(idx, 'pattaNo', e.target.value)}
                  placeholder="e.g. 1042"
                  className={`w-full border rounded p-2 text-xs font-bold text-slate-800 ${
                    errors?.[`surveys.${idx}.pattaNo`] ? 'border-rose-400' : 'border-slate-250'
                  }`}
                />
                {errors?.[`surveys.${idx}.pattaNo`] && (
                  <span className="text-[9px] text-rose-500 block">{errors[`surveys.${idx}.pattaNo`]}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  TSLR Number
                </label>
                <input
                  type="text"
                  value={survey.tslrNo}
                  onChange={(e) => updateSurveyField(idx, 'tslrNo', e.target.value)}
                  placeholder="TS-142 (Urban plot reference)"
                  className="w-full border border-slate-250 rounded p-2 text-xs text-slate-800 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block">
                  Chitta Reference <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={survey.chittaRef || ''}
                  onChange={(e) => updateSurveyField(idx, 'chittaRef', e.target.value)}
                  placeholder="e.g. CH-2026-991"
                  className={`w-full border rounded p-2 text-xs text-slate-800 font-mono ${
                    errors?.[`surveys.${idx}.chittaRef`] ? 'border-rose-400' : 'border-slate-250'
                  }`}
                />
                {errors?.[`surveys.${idx}.chittaRef`] && (
                  <span className="text-[9px] text-rose-500 block">{errors[`surveys.${idx}.chittaRef`]}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
