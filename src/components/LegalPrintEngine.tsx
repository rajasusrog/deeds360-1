import { tamilPrintFontCss } from '../utils/tamilFonts';
import { useState, useEffect, useRef } from 'react';
import { 
  Settings, 
  FileText, 
  Printer, 
  Eye, 
  EyeOff, 
  Layers, 
  Compass, 
  HelpCircle, 
  Sliders, 
  Download,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Lock,
  Unlock,
  RotateCcw,
  Check,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { DeedWizardState, SavedDraft } from '../types';
import { tryCompileDeedDocument, LegalSection } from '../utils/documentGenerator';
import { formatIndianCurrency } from '../utils/amountFormatter';
import { QRCodeSVG, BarcodeSVG } from '../utils/qrBarcodeGenerator';
import { generateCanonicalDOCX, generateCanonicalPDF } from '../utils/documentExportEngine';
import { isDeedTemplateAvailable, normalizeDeedCode, resolveDeedType } from '../utils/deedTypes';
import { sanitizeHtml } from '../utils/htmlSanitizer';

interface LegalPrintEngineProps {
  state: DeedWizardState;
  currentDraft: SavedDraft | null;
  onFinalize?: () => void;
  onNewRevision?: () => void;
  isLocked?: boolean;
}

interface PrintConfig {
  profile: 'plain' | 'physical' | 'estamp' | 'custom';
  paperSize: 'A4' | 'Legal';
  firstPageTopOffset: number; // in mm
  topMargin: number; // in mm
  bottomMargin: number; // in mm
  leftMargin: number; // in mm
  rightMargin: number; // in mm
  headerHeight: number; // in mm
  footerHeight: number; // in mm
  showGuides: boolean;
}

const DEFAULT_PROFILE_BY_TEMPLATE: Record<string, 'plain' | 'physical' | 'estamp' | 'custom'> = {
  'SALE': 'estamp',
  'SETTLEMENT': 'physical',
  'SETTLE': 'physical',
  'GIFT': 'physical',
  'PARTITION': 'physical',
  'LEASE': 'plain',
  'MORTGAGE': 'estamp',
  'POA': 'plain',
  'POWER OF ATTORNEY': 'plain'
};

const PROFILE_DEFAULTS: Record<'plain' | 'physical' | 'estamp' | 'custom', Partial<PrintConfig>> = {
  plain: {
    firstPageTopOffset: 25,
    topMargin: 20,
    bottomMargin: 20,
    leftMargin: 25,
    rightMargin: 20,
    headerHeight: 10,
    footerHeight: 12
  },
  physical: {
    firstPageTopOffset: 120,
    topMargin: 20,
    bottomMargin: 20,
    leftMargin: 25,
    rightMargin: 20,
    headerHeight: 10,
    footerHeight: 12
  },
  estamp: {
    firstPageTopOffset: 90,
    topMargin: 20,
    bottomMargin: 20,
    leftMargin: 25,
    rightMargin: 20,
    headerHeight: 10,
    footerHeight: 12
  },
  custom: {
    firstPageTopOffset: 60,
    topMargin: 20,
    bottomMargin: 20,
    leftMargin: 25,
    rightMargin: 20,
    headerHeight: 10,
    footerHeight: 12
  }
};

export default function LegalPrintEngine({ 
  state, 
  currentDraft,
  onFinalize,
  onNewRevision,
  isLocked = false
}: LegalPrintEngineProps) {
  const docType = normalizeDeedCode(state.documentType) || state.documentType?.toUpperCase() || 'SALE';
  const defaultProfile = DEFAULT_PROFILE_BY_TEMPLATE[docType] || 'estamp';
  const deedDef = resolveDeedType(state.documentType);
  const templateAvailable = isDeedTemplateAvailable(state.documentType);

  // State
  const [config, setConfig] = useState<PrintConfig>({
    profile: defaultProfile,
    paperSize: 'A4',
    firstPageTopOffset: PROFILE_DEFAULTS[defaultProfile].firstPageTopOffset || 90,
    topMargin: 20,
    bottomMargin: 20,
    leftMargin: 25,
    rightMargin: 20,
    headerHeight: 10,
    footerHeight: 12,
    showGuides: true
  });

  const [paginatedPages, setPaginatedPages] = useState<LegalSection[][]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [includeDigitalSeals, setIncludeDigitalSeals] = useState<boolean>(true);
  const [includeLawyerSign, setIncludeLawyerSign] = useState<boolean>(true);
  const [generatingType, setGeneratingType] = useState<'pdf' | 'docx' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4500);
  };

  // References
  const measureContainerRef = useRef<HTMLDivElement>(null);
  const referenceMmRef = useRef<HTMLDivElement>(null);

  // Constants
  const docNo = currentDraft?.docNo || 'DEED/2026/0142';
  const SRO = state.property?.sro || '————';
  const execDate = state.transaction?.paymentDate || new Date().toISOString().split('T')[0];
  const token = currentDraft 
    ? `DRAFT-REF-${currentDraft.docNo.replace(/[^0-9]/g, '') || '1042099'}`
    : `DRAFT-REF-1042099`;

  const { deed: compiledDeed, error: compileError } = tryCompileDeedDocument(state, docNo);
  const compiledSections = compiledDeed?.sections || [];

  const handleExportPDF = async () => {
    if (!templateAvailable || !compiledDeed) {
      showNotification('error', compileError || 'Template unavailable: PDF generation is blocked.');
      return;
    }
    setGeneratingType('pdf');
    try {
      const res = await generateCanonicalPDF(state, docNo, { paperSize: config.paperSize });
      if (res.success && res.blob && res.blob.size > 0) {
        showNotification('success', 'PDF draft generated successfully');
      } else {
        showNotification('error', res.error || 'PDF generation failed: No binary output produced.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'PDF export encountered an unexpected error.');
    } finally {
      setGeneratingType(null);
    }
  };

  const handleExportDOCX = async () => {
    if (!templateAvailable || !compiledDeed) {
      showNotification('error', compileError || 'Template unavailable: DOCX generation is blocked.');
      return;
    }
    setGeneratingType('docx');
    try {
      const res = await generateCanonicalDOCX(state, docNo);
      if (res.success && res.blob && res.blob.size > 0) {
        showNotification('success', 'DOCX draft generated successfully');
      } else {
        showNotification('error', res.error || 'DOCX generation failed: No binary output produced.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'DOCX export encountered an unexpected error.');
    } finally {
      setGeneratingType(null);
    }
  };

  // Apply default profile settings when profile changes
  const handleProfileChange = (profile: 'plain' | 'physical' | 'estamp' | 'custom') => {
    const defaults = PROFILE_DEFAULTS[profile];
    setConfig(prev => ({
      ...prev,
      profile,
      firstPageTopOffset: defaults.firstPageTopOffset ?? prev.firstPageTopOffset,
      topMargin: defaults.topMargin ?? prev.topMargin,
      bottomMargin: defaults.bottomMargin ?? prev.bottomMargin,
      leftMargin: defaults.leftMargin ?? prev.leftMargin,
      rightMargin: defaults.rightMargin ?? prev.rightMargin,
      headerHeight: defaults.headerHeight ?? prev.headerHeight,
      footerHeight: defaults.footerHeight ?? prev.footerHeight
    }));
  };

  // Dimensions based on paper size
  const pageHeightMm = config.paperSize === 'A4' ? 297 : 355.6;
  const pageWidthMm = config.paperSize === 'A4' ? 210 : 215.9;

  // Measurement and dynamic pagination logic
  useEffect(() => {
    if (!measureContainerRef.current || !referenceMmRef.current) return;

    const measureAndPaginate = () => {
      // Find the px height of 100mm reference element to calculate exact px-to-mm ratio
      const refHeightPx = referenceMmRef.current?.offsetHeight || 378;
      const pxToMm = 100 / refHeightPx;

      // Measure each section row block inside the hidden container
      const rows = Array.from(measureContainerRef.current!.children) as HTMLDivElement[];
      const sectionHeightsMm = rows.map(row => {
        return row.offsetHeight * pxToMm;
      });

      // Pagination Algorithm
      const pages: LegalSection[][] = [[]];
      let currentPageIdx = 0;
      let currentPageUsedHeight = 0;

      compiledSections.forEach((section, index) => {
        const rowHeight = sectionHeightsMm[index] || 40; // Fallback to 40mm

        // Determine available height for current page
        const topSpace = currentPageIdx === 0 ? config.firstPageTopOffset : config.topMargin;
        const availableHeight = pageHeightMm - topSpace - config.bottomMargin - config.headerHeight - config.footerHeight;

        if (currentPageUsedHeight + rowHeight > availableHeight) {
          // If we already have items on the current page, start a new page
          if (currentPageUsedHeight > 0) {
            pages.push([section]);
            currentPageIdx++;
            currentPageUsedHeight = rowHeight;
          } else {
            // If it's a single massive section that can't fit even on an empty page, place it anyway
            pages[currentPageIdx].push(section);
            currentPageUsedHeight += rowHeight;
          }
        } else {
          // Fits on current page
          pages[currentPageIdx].push(section);
          currentPageUsedHeight += rowHeight;
        }
      });

      setPaginatedPages(pages);
    };

    // Delay slightly to ensure browser has completed initial layout
    const timer = setTimeout(measureAndPaginate, 150);
    return () => clearTimeout(timer);
  }, [config, state, includeDigitalSeals, includeLawyerSign, compiledSections.length]);

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativePrint = () => {
    if (!templateAvailable || !compiledDeed) {
      showNotification('error', compileError || 'Template unavailable: Printing is blocked.');
      return;
    }
    // Generate styled print contents
    const printWindow = window.open('', '_blank', 'width=950,height=800');
    if (!printWindow) return;

    const pageCss = `
      @import url('https://fonts.googleapis.com/css2?family=Mukta+Malar:wght@400;700&display=swap');
      @page {
        size: ${config.paperSize === 'A4' ? 'A4' : 'legal'} portrait;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 0;
        background-color: #ffffff;
        color: #000000;
        font-family: 'Times New Roman', Times, serif;
        font-size: 11pt;
        line-height: 1.5;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .print-page {
        width: ${pageWidthMm}mm;
        height: ${pageHeightMm}mm;
        box-sizing: border-box;
        position: relative;
        page-break-after: always;
        break-after: page;
        display: flex;
        flex-direction: column;
      }
      .page-content-wrapper {
        flex-grow: 1;
        width: 100%;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
      }
      .text-justify {
        text-align: justify;
      }
      .tamil-text {
        font-family: 'Noto Sans Tamil', sans-serif;
        font-size: 9.5pt;
        line-height: 1.5;
      }
      .bilingual-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 25px;
      }
      .photo-block {
        width: 70px;
        height: 85px;
        border: 1px solid #94a3b8;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 7pt;
        background: #f8fafc;
        text-align: center;
        color: #64748b;
      }
      .thumb-block {
        width: 70px;
        height: 50px;
        border: 1px dashed #94a3b8;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 7pt;
        background: #f8fafc;
        text-align: center;
        color: #64748b;
      }
      .sig-box {
        border-top: 1px solid #000;
        margin-top: 35px;
        padding-top: 5px;
        font-size: 8.5pt;
      }
      .table-bordered {
        width: 100%;
        border-collapse: collapse;
      }
      .table-bordered td, .table-bordered th {
        border: 1px solid #94a3b8;
        padding: 6px;
        font-size: 8.5pt;
      }
      @media print {
        body { background: #fff; }
        .no-print { display: none; }
      }
    `;

    // Extract dynamic page rendering
    const renderedPagesHtml = paginatedPages.map((pageSections, pIdx) => {
      const isFirst = pIdx === 0;
      const topOffset = isFirst ? config.firstPageTopOffset : config.topMargin;
      
      const paddingStyle = {
        paddingTop: `${topOffset}mm`,
        paddingBottom: `${config.bottomMargin}mm`,
        paddingLeft: `${config.leftMargin}mm`,
        paddingRight: `${config.rightMargin}mm`
      };

      const headerStyle = {
        height: `${config.headerHeight}mm`,
        paddingLeft: `${config.leftMargin}mm`,
        paddingRight: `${config.rightMargin}mm`,
        top: `${isFirst ? (config.firstPageTopOffset - config.headerHeight - 2) : (config.topMargin - config.headerHeight - 2)}mm`
      };

      const footerStyle = {
        height: `${config.footerHeight}mm`,
        paddingLeft: `${config.leftMargin}mm`,
        paddingRight: `${config.rightMargin}mm`,
        bottom: `${config.bottomMargin - config.footerHeight}mm`
      };

      return `
        <div class="print-page" style="padding-top: ${paddingStyle.paddingTop}; padding-bottom: ${paddingStyle.paddingBottom}; padding-left: ${paddingStyle.paddingLeft}; padding-right: ${paddingStyle.paddingRight};">
          
          <!-- Page Header -->
          <div style="position: absolute; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; font-family: monospace; font-size: 8pt; color: #475569; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; ${headerStyle.top ? `top: ${headerStyle.top};` : ''} margin-left: ${config.leftMargin}mm; margin-right: ${config.rightMargin}mm;">
            <span>DOC ID: ${docNo}</span>
            <span>DEED360 · DOCUMENT DRAFT</span>
            <span>VERSION: v${currentDraft?.version || 1}.0-DRAFT</span>
          </div>

          <div class="page-content-wrapper">
            <!-- Stamp Paper Area Visual Indicator if Physical/E-stamp -->
            ${isFirst && config.profile === 'physical' ? `
              <div style="height: 0px; margin-bottom: 0px; text-align: center; color: #94a3b8; font-family: sans-serif; font-size: 10px;">
                <!-- Physical stamp space reserved -->
              </div>
            ` : ''}
            
            ${isFirst && config.profile === 'estamp' ? `
              <div style="position: absolute; top: 15mm; left: ${config.leftMargin}mm; right: ${config.rightMargin}mm; height: 60mm; border: 3px double #334155; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #f8fafc; text-align: center;">
                <p style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin: 0; color: #334155; font-family: sans-serif;">DRAFT DEED FOR EXECUTION & PRESENTATION — NOT A GOVERNMENT REGISTRATION CERTIFICATE</p>
                <h2 style="font-size: 18px; font-weight: 900; letter-spacing: 0.08em; margin: 4px 0; color: #0f172a; font-family: serif;">${compiledDeed?.metadata.deedNameEn.toUpperCase() || 'DEED DRAFT'}</h2>
                <p style="font-size: 8px; font-weight: bold; color: #475569; margin: 0; font-family: sans-serif;">பத்திர வரைவு • அரசுப் பதிவுச் சான்றிதழ் அல்ல (UNREGISTERED DRAFT)</p>
                <div style="border-top: 1px dashed #64748b; margin: 6px 0; width: 100%;"></div>
                <div style="display: flex; justify-content: space-between; width: 100%; font-size: 8px; font-family: monospace; font-weight: bold; color: #334155;">
                  <span>TARGET SRO: ${SRO}</span>
                  <span>DRAFT REF: ${docNo}</span>
                  <span>DECLARED VAL: ${formatIndianCurrency(state.transaction.marketValue || 0)}</span>
                </div>
              </div>
            ` : ''}

            <!-- Actual dynamic sections -->
            <div class="space-y-6" style="margin-top: 5px;">
              ${pageSections.map(section => {
                const isTitle = section.id === 'title';
                const isSignatures = section.id === 'signatures';

                if (isTitle) {
                  return `
                    <div style="text-align: center; border-b: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px;">
                      <div class="bilingual-grid">
                        <div class="tamil-text" style="font-weight: bold;">${section.contentTa}</div>
                        <div style="font-family: 'Times New Roman', serif; font-weight: bold;">${section.contentEn}</div>
                      </div>
                    </div>
                  `;
                }

                if (isSignatures) {
                  return `
                    <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 15px;">
                      <div class="bilingual-grid">
                        <div class="tamil-text">${section.contentTa}</div>
                        <div style="font-family: 'Times New Roman', serif;">${section.contentEn}</div>
                      </div>
                    </div>
                  `;
                }

                return `
                  <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 12px;">
                    <p style="font-size: 8pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #047857; margin-bottom: 6px;">
                      ${section.titleEn} / ${section.titleTa}
                    </p>
                    <div class="bilingual-grid">
                      <div class="tamil-text text-justify">${section.contentTa}</div>
                      <div class="text-justify" style="font-family: 'Times New Roman', serif; font-size: 10pt;">${section.contentEn}</div>
                    </div>
                  </div>
                `;
              }).join('')}

              <!-- Draft preparation metadata on last page -->
              ${pIdx === paginatedPages.length - 1 && includeDigitalSeals ? `
                <div style="margin-top: 20px; padding: 10px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                  <div style="font-family: monospace; font-size: 7px; color: #475569;">
                    <p style="font-weight: bold; color: #1e293b; margin: 0;">UNREGISTERED DRAFT RECORD — FOR SRO SUBMISSION</p>
                    <p style="margin: 0;">PREPARED: ${new Date().toISOString().substring(0, 16)}</p>
                    <p style="margin: 0;">DRAFT REF: ${token}</p>
                  </div>
                  <div style="font-family: sans-serif; font-size: 7px; color: #64748b; text-align: right;">
                    <p style="margin: 0; font-weight: bold;">NOT A GOVERNMENT REGISTRATION CERTIFICATE</p>
                    <p style="margin: 0;">Subject to execution & presentation before Sub-Registrar</p>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Page Footer -->
          <div style="position: absolute; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; font-family: monospace; font-size: 8pt; color: #94a3b8; border-top: 1px solid #cbd5e1; padding-top: 4px; ${footerStyle.bottom ? `bottom: ${footerStyle.bottom};` : ''} margin-left: ${config.leftMargin}mm; margin-right: ${config.rightMargin}mm;">
            <span>TN REGINET SECURE TOKEN: ${token}</span>
            <span>PAGE ${pIdx + 1} OF ${paginatedPages.length}</span>
            <span>SECURE DATE: ${new Date().toLocaleDateString()}</span>
          </div>

        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${docNo} - Deed360 Draft</title>
          <style>${tamilPrintFontCss(window.location.origin)}${pageCss}</style>
        </head>
        <body>
          ${sanitizeHtml(renderedPagesHtml)}
        </body>
      </html>
    `);

    printWindow.document.close();
    void (async () => {
      await printWindow.document.fonts.load('400 12px "Noto Sans Tamil"', 'தமிழ்');
      await printWindow.document.fonts.load('700 12px "Noto Sans Tamil"', 'தமிழ்');
      await printWindow.document.fonts.ready;
      printWindow.onafterprint = () => printWindow.close();
      printWindow.print();
    })().catch(() => window.alert('Tamil print font could not load. Please retry.'));
  };

  return (
    <div className="p-6 text-left space-y-6 text-slate-800 font-sans relative" id="legal-print-engine-panel">
      
      {/* Toast Feedback Notification */}
      {feedback && (
        <div 
          className={`sticky top-2 z-50 p-3 rounded-xl text-xs font-bold shadow-xl border flex items-center justify-between gap-2 ${
            feedback.type === 'success' 
              ? 'bg-emerald-950 text-emerald-100 border-emerald-700' 
              : 'bg-rose-950 text-rose-100 border-rose-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button 
            onClick={() => setFeedback(null)} 
            className="text-slate-400 hover:text-white px-2 py-0.5 rounded text-[10px]"
          >
            ✕
          </button>
        </div>
      )}

      {/* Configuration Widget & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Print Configuration Controls */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 space-y-5 shadow-sm">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-emerald-600" />
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">Legal Print Engine Profiles</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Paper:</span>
              <select
                value={config.paperSize}
                onChange={(e) => setConfig(prev => ({ ...prev, paperSize: e.target.value as 'A4' | 'Legal' }))}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="A4">A4 (210 x 297mm)</option>
                <option value="Legal">Legal (216 x 356mm)</option>
              </select>
            </div>
          </div>

          {/* Quick Profile Selection */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: 'plain', label: 'Plain Paper', desc: 'Plain A4 or Legal paper' },
              { id: 'physical', label: 'Physical Stamp', desc: 'Reserved top stamp area' },
              { id: 'estamp', label: 'E-Stamp Paper', desc: 'Govt digital estamp template' },
              { id: 'custom', label: 'Custom Layout', desc: 'Manual millimeter margins' }
            ].map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleProfileChange(profile.id as any)}
                className={`p-3 rounded-xl border text-left transition space-y-1 ${
                  config.profile === profile.id 
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-500' 
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <span className={`font-bold block text-xs ${config.profile === profile.id ? 'text-emerald-800' : 'text-slate-800'}`}>
                  {profile.label}
                </span>
                <span className="text-[10px] text-slate-400 block leading-tight">
                  {profile.desc}
                </span>
              </button>
            ))}
          </div>

          {/* Detailed Config Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            {/* First Page Offset */}
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
                <Sliders className="h-3 w-3 text-slate-400" />
                <span>First Page Top Offset (mm)</span>
              </label>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  min="10" 
                  max="180" 
                  value={config.firstPageTopOffset}
                  onChange={(e) => setConfig(prev => ({ ...prev, firstPageTopOffset: parseInt(e.target.value) }))}
                  className="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                />
                <span className="font-mono text-xs font-bold w-12 text-right text-slate-700 bg-slate-50 border rounded px-1.5 py-0.5">{config.firstPageTopOffset}mm</span>
              </div>
              <p className="text-[9px] text-slate-400">Reserved space for physical stamps or headings on page 1.</p>
            </div>

            {/* Top/Bottom Margins */}
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
                <Compass className="h-3 w-3 text-slate-400" />
                <span>Other Pages Margins (mm)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-slate-400">Top Marg:</span>
                  <input 
                    type="number" 
                    value={config.topMargin}
                    onChange={(e) => setConfig(prev => ({ ...prev, topMargin: parseInt(e.target.value) || 20 }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-xs font-bold"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400">Bottom Marg:</span>
                  <input 
                    type="number" 
                    value={config.bottomMargin}
                    onChange={(e) => setConfig(prev => ({ ...prev, bottomMargin: parseInt(e.target.value) || 20 }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Left/Right Margins */}
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
                <Layers className="h-3 w-3 text-slate-400" />
                <span>Side Margins (mm)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-slate-400">Left Marg:</span>
                  <input 
                    type="number" 
                    value={config.leftMargin}
                    onChange={(e) => setConfig(prev => ({ ...prev, leftMargin: parseInt(e.target.value) || 25 }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-xs font-bold"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400">Right Marg:</span>
                  <input 
                    type="number" 
                    value={config.rightMargin}
                    onChange={(e) => setConfig(prev => ({ ...prev, rightMargin: parseInt(e.target.value) || 20 }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-xs font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Additional Heights & Visual Guides toggle */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider block">Header Height (mm)</span>
              <input 
                type="number" 
                value={config.headerHeight}
                onChange={(e) => setConfig(prev => ({ ...prev, headerHeight: parseInt(e.target.value) || 10 }))}
                className="w-24 bg-slate-50 border border-slate-200 rounded px-2 py-1 font-mono text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider block">Footer Height (mm)</span>
              <input 
                type="number" 
                value={config.footerHeight}
                onChange={(e) => setConfig(prev => ({ ...prev, footerHeight: parseInt(e.target.value) || 12 }))}
                className="w-24 bg-slate-50 border border-slate-200 rounded px-2 py-1 font-mono text-xs font-bold"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-xl border border-slate-150">
              <div>
                <span className="font-bold text-xs block text-slate-700">Visual Guidelines</span>
                <span className="text-[9px] text-slate-400 block">Show page-safe print borders in preview</span>
              </div>
              <input 
                type="checkbox" 
                checked={config.showGuides}
                onChange={(e) => setConfig(prev => ({ ...prev, showGuides: e.target.checked }))}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer" 
              />
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap gap-2.5 pt-4 border-t border-slate-100 justify-end items-center">
            <button
              onClick={handleNativePrint}
              disabled={!templateAvailable}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-800 text-xs font-bold rounded-xl border border-slate-200 shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              title="Open browser print preview dialog"
            >
              <Printer className="h-3.5 w-3.5 text-slate-600" />
              <span>Print Deed</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={generatingType !== null || !templateAvailable}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              title="Generate real binary multi-page PDF"
            >
              {generatingType === 'pdf' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-300" />
              ) : (
                <Download className="h-3.5 w-3.5 text-slate-300" />
              )}
              <span>Generate PDF</span>
            </button>

            <button
              onClick={handleExportDOCX}
              disabled={generatingType !== null || !templateAvailable}
              className="px-4 py-2 bg-[#c49a36] hover:bg-[#b58a2b] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              title="Generate genuine OpenXML DOCX document"
            >
              {generatingType === 'docx' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
              ) : (
                <Download className="h-3.5 w-3.5 text-white" />
              )}
              <span>Generate DOCX</span>
            </button>

            {isLocked ? (
              onNewRevision && (
                <button
                  onClick={onNewRevision}
                  className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Sprout Revision</span>
                </button>
              )
            ) : (
              onFinalize && (
                <button
                  onClick={onFinalize}
                  disabled={!templateAvailable}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Lock Draft</span>
                </button>
              )
            )}
          </div>

        </div>

        {/* Info Box / Layers Controls */}
        <div className="space-y-4">
          {/* Metadata info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm text-xs">
            <h4 className="font-extrabold uppercase text-slate-400 tracking-wider text-[10px]">Deed360 Live Ledger Status</h4>
            <div className="space-y-2 mt-2">
              <div className="flex justify-between">
                <span>Ref Number:</span>
                <span className="font-mono font-bold text-slate-800">{docNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Print Profile:</span>
                <span className="font-bold text-emerald-700 uppercase">{config.profile}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Dynamic Pages:</span>
                <span className="font-mono font-bold text-indigo-800 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                  {paginatedPages.length} Pages
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2 rounded-lg mt-3">
              <span className="font-mono text-[10px] text-slate-600 truncate">{token}</span>
              <button 
                onClick={copyToken} 
                className={`p-1 rounded transition shrink-0 ${copied ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-slate-100 text-slate-400'}`}
                title="Copy Token"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Layer configs */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm text-xs">
            <h4 className="font-extrabold uppercase text-slate-400 tracking-wider text-[10px]">Print Layer Settings</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 p-1.5 rounded hover:bg-slate-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={includeDigitalSeals}
                  onChange={(e) => setIncludeDigitalSeals(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4" 
                />
                <div>
                  <span className="font-bold block text-slate-700">Digital Validation Seals</span>
                  <span className="text-[9px] text-slate-400">Embed official approval & SRO stamps</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-1.5 rounded hover:bg-slate-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={includeLawyerSign}
                  onChange={(e) => setIncludeLawyerSign(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4" 
                />
                <div>
                  <span className="font-bold block text-slate-700">Verified Legal Counsel Block</span>
                  <span className="text-[9px] text-slate-400">Append lawyer witness field</span>
                </div>
              </label>
            </div>
          </div>
        </div>

      </div>

      {/* Visual Paginated Preview Area */}
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-slate-100 p-3 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-emerald-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">Interactive Legal Preview Sheet</span>
          </div>
          <span className="text-[10px] font-extrabold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-mono">
            DYNAMIC MILLIMETER ENGINE • {paginatedPages.length} PAGES COMPILED
          </span>
        </div>

        {/* Multi-Page Visual Output Grid */}
        <div className="flex flex-col items-center gap-8 bg-slate-100/60 p-6 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto">
          {paginatedPages.map((pageSections, pIdx) => {
            const isFirst = pIdx === 0;
            const topOffset = isFirst ? config.firstPageTopOffset : config.topMargin;

            return (
              <div 
                key={pIdx}
                className="bg-white border border-slate-300 rounded shadow-lg relative flex flex-col justify-between selection:bg-emerald-100"
                style={{ 
                  width: `${pageWidthMm}mm`, 
                  height: `${pageHeightMm}mm`,
                  paddingTop: `${topOffset}mm`,
                  paddingBottom: `${config.bottomMargin}mm`,
                  paddingLeft: `${config.leftMargin}mm`,
                  paddingRight: `${config.rightMargin}mm`,
                  boxSizing: 'border-box'
                }}
              >
                {/* Visual Preview Guide Overlays */}
                {config.showGuides && (
                  <>
                    {/* Reserved stamp area guide on Page 1 */}
                    {isFirst && config.firstPageTopOffset > 25 && (
                      <div 
                        className="absolute left-0 right-0 top-0 border-b-2 border-dashed border-rose-300 bg-rose-50/10 flex items-center justify-center text-center text-[10px] font-extrabold text-rose-500 uppercase tracking-widest select-none pointer-events-none"
                        style={{ height: `${config.firstPageTopOffset}mm` }}
                      >
                        <div className="space-y-1 p-2 rounded bg-white/90 shadow-sm border border-rose-200">
                          <p>Reserved Stamp Space / Govt Heading Zone</p>
                          <p className="text-[8px] text-rose-400 font-mono">Height: {config.firstPageTopOffset}mm offset</p>
                        </div>
                      </div>
                    )}

                    {/* Left margin boundary line guide */}
                    <div 
                      className="absolute top-0 bottom-0 border-r border-dashed border-emerald-300/40 select-none pointer-events-none"
                      style={{ left: `${config.leftMargin}mm` }}
                    />
                    {/* Right margin boundary line guide */}
                    <div 
                      className="absolute top-0 bottom-0 border-l border-dashed border-emerald-300/40 select-none pointer-events-none"
                      style={{ right: `${config.rightMargin}mm` }}
                    />
                    {/* Bottom footer boundary line guide */}
                    <div 
                      className="absolute left-0 right-0 border-t border-dashed border-indigo-300/40 select-none pointer-events-none"
                      style={{ bottom: `${config.bottomMargin}mm` }}
                    />
                    {/* Printable area border visual outline */}
                    <div 
                      className="absolute border border-dotted border-slate-200 rounded pointer-events-none select-none"
                      style={{
                        top: `${topOffset}mm`,
                        bottom: `${config.bottomMargin}mm`,
                        left: `${config.leftMargin}mm`,
                        right: `${config.rightMargin}mm`
                      }}
                    />
                  </>
                )}

                {/* Page Header (rendered absolute inside A4) */}
                <div 
                  className="absolute left-0 right-0 flex justify-between items-center font-mono text-[8px] text-slate-500 border-b border-slate-100 pb-1"
                  style={{ 
                    top: `${isFirst ? (config.firstPageTopOffset - config.headerHeight - 2) : (config.topMargin - config.headerHeight - 2)}mm`,
                    marginLeft: `${config.leftMargin}mm`,
                    marginRight: `${config.rightMargin}mm`
                  }}
                >
                  <span>DOC ID: {docNo}</span>
                  <span>DEED360 · DOCUMENT DRAFT</span>
                  <span>VERSION: v{currentDraft?.version || 1}.0-DRAFT</span>
                </div>

                {/* Printable Content Block */}
                <div className="flex-grow w-full flex flex-col font-serif">
                  {/* Draft Header visual in preview if selected on page 1 */}
                  {isFirst && config.profile === 'estamp' && (
                    <div className="border-[3px] border-double border-slate-700 p-2.5 mb-4 flex flex-col items-center bg-slate-50 rounded relative overflow-hidden select-none">
                      <div className="text-center font-serif text-slate-800 tracking-wider">
                        <p className="text-[8px] font-bold uppercase leading-none text-slate-600">
                          DRAFT DEED FOR EXECUTION & PRESENTATION — NOT A GOVERNMENT REGISTRATION CERTIFICATE
                        </p>
                        <h2 className="text-base font-black tracking-widest mt-1 mb-0.5 text-slate-900">
                          {compiledDeed?.metadata.deedNameEn.toUpperCase() || 'DEED DRAFT'}
                        </h2>
                        <p className="text-[7px] font-bold text-slate-600">பத்திர வரைவு • அரசுப் பதிவுச் சான்றிதழ் அல்ல (UNREGISTERED DRAFT)</p>
                      </div>
                      <div className="w-full border-t border-dashed border-slate-400 my-1.5" />
                      <div className="flex justify-between w-full text-[8px] font-mono font-bold text-slate-700 px-2">
                        <span>TARGET SRO: {SRO}</span>
                        <span>DRAFT REF: {docNo}</span>
                        <span>DECLARED VAL: {formatIndianCurrency(state.transaction.marketValue || 0)}</span>
                      </div>
                    </div>
                  )}

                  {/* Dynamic sections of this specific page */}
                  <div className="space-y-4">
                    {pageSections.map(section => {
                      const isTitle = section.id === 'title';
                      const isSignatures = section.id === 'signatures';

                      if (isTitle) {
                        return (
                          <div key={section.id} className="text-center border-b border-slate-200 pb-2 mb-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="font-sans font-bold text-[11px] text-slate-800 text-center" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentTa) }} />
                              <div className="font-serif font-bold text-[11px] text-slate-800 text-center" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentEn) }} />
                            </div>
                          </div>
                        );
                      }

                      if (isSignatures) {
                        return (
                          <div key={section.id} className="pt-3 border-t border-slate-200">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="font-sans text-[9px] text-slate-800" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentTa) }} />
                              <div className="font-serif text-[9px] text-slate-800" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentEn) }} />
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={section.id} className="border-b border-slate-100 pb-2 space-y-1">
                          <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-800 font-mono">
                            {section.titleEn} / {section.titleTa}
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="font-sans text-[9.5px] text-slate-700 leading-normal text-justify" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentTa) }} />
                            <div className="font-serif text-[9.5px] text-slate-800 leading-normal text-justify" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentEn) }} />
                          </div>
                        </div>
                      );
                    })}

                    {/* Draft preparation metadata block on last page preview */}
                    {pIdx === paginatedPages.length - 1 && includeDigitalSeals && (
                      <div className="pt-3 mt-3 border-t border-dashed border-slate-200 flex justify-between items-center gap-4 bg-slate-50 p-2.5 rounded-xl border border-slate-200 select-none">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="h-5 w-5 text-slate-600 shrink-0" />
                          <div className="font-mono text-[6.5px] text-slate-600">
                            <p className="font-extrabold text-slate-800">UNREGISTERED DRAFT RECORD — FOR SRO SUBMISSION</p>
                            <p>PREPARED: {new Date().toISOString().substring(0,16)}</p>
                            <p>DRAFT REF: {token}</p>
                          </div>
                        </div>
                        <div className="text-right font-sans text-[6.5px] text-slate-500">
                          <p className="font-bold text-slate-700">NOT A GOVERNMENT REGISTRATION CERTIFICATE</p>
                          <p>App finalization does not constitute registration under the Registration Act, 1908</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Page Footer (rendered absolute inside A4) */}
                <div 
                  className="absolute left-0 right-0 flex justify-between items-center font-mono text-[8px] text-slate-400 border-t border-slate-100 pt-1"
                  style={{ 
                    bottom: `${config.bottomMargin - config.footerHeight}mm`,
                    marginLeft: `${config.leftMargin}mm`,
                    marginRight: `${config.rightMargin}mm`
                  }}
                >
                  <span>DRAFT REF: {token}</span>
                  <span>PAGE {pIdx + 1} OF {paginatedPages.length}</span>
                  <span>PREPARED: {new Date().toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hidden layout elements for pixel height measurement */}
      <div className="absolute top-0 left-0 w-0 h-0 overflow-hidden select-none pointer-events-none">
        {/* Exact reference div to map pixel to millimeters */}
        <div ref={referenceMmRef} style={{ height: '100mm', width: '100mm' }} />

        {/* Dynamic measurement sheet container */}
        <div 
          ref={measureContainerRef} 
          style={{ width: `${pageWidthMm}mm`, fontFamily: "'Times New Roman', serif" }}
          className="bg-white text-[11px] leading-relaxed text-slate-800"
        >
          {compiledSections.map((section, idx) => {
            const isTitle = section.id === 'title';
            const isSignatures = section.id === 'signatures';

            if (isTitle) {
              return (
                <div key={idx} className="text-center border-b border-slate-200 pb-2 mb-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="font-sans font-bold text-[11px]" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentTa) }} />
                    <div className="font-serif font-bold text-[11px]" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentEn) }} />
                  </div>
                </div>
              );
            }

            if (isSignatures) {
              return (
                <div key={idx} className="pt-3 border-t border-slate-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="font-sans text-[9px]" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentTa) }} />
                    <div className="font-serif text-[9px]" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentEn) }} />
                  </div>
                </div>
              );
            }

            return (
              <div key={idx} className="border-b border-slate-100 pb-2 space-y-1">
                <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-800 font-mono">
                  {section.titleEn} / {section.titleTa}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="font-sans text-[9.5px] leading-normal text-justify" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentTa) }} />
                  <div className="font-serif text-[9.5px] leading-normal text-justify" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentEn) }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
