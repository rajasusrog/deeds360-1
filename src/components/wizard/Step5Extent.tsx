import Step5Measurement from './Step5Measurement';
import { ExtentDetails } from '../../types';

interface Step5ExtentProps {
  extent: ExtentDetails;
  onChange: (extent: ExtentDetails) => void;
  errors?: Record<string, string>;
}

export default function Step5Extent({ extent, onChange, errors }: Step5ExtentProps) {
  return <Step5Measurement extent={extent} onChange={onChange} errors={errors} />;
}
