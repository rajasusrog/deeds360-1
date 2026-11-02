interface UnikornLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}
export default function UnikornLogo({ className = '', size = 'md', showText = true }: UnikornLogoProps) {
  const widths = { sm: 'w-28', md: 'w-40', lg: 'w-44', xl: 'w-52' };
  return <div className={`inline-flex flex-col items-start gap-3 ${className}`}>
    <img src="/unikorn360-brand-20261031.svg" alt="UNIKORN360 Business Intelligence" width="1254" height="1254" className={`${widths[size]} h-auto max-w-full rounded-lg object-contain`} />
    {showText && <span className="text-base font-semibold tracking-wide text-white">Deed<span className="text-amber-200">360</span></span>}
  </div>;
}
