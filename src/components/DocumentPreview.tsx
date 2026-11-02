import { tamilPrintFontCss } from '../utils/tamilFonts';
import { useState, useRef } from 'react';
import { FileText, Download, Printer, ShieldCheck, CheckCircle2, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import { DeedWizardState } from '../types';
import { tryCompileDeedDocument } from '../utils/documentGenerator';
import { formatIndianCurrency } from '../utils/amountFormatter';
import { generateCanonicalDOCX, generateCanonicalPDF } from '../utils/documentExportEngine';
import { isDeedTemplateAvailable, resolveDeedType } from '../utils/deedTypes';
import { sanitizeHtml } from '../utils/htmlSanitizer';

interface DocumentPreviewProps {
  state: DeedWizardState;
  activeStep: number;
}

export default function DocumentPreview({ state }: DocumentPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [generatingType, setGeneratingType] = useState<'pdf' | 'docx' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const docNo = 'DEED/2026/0142';
  const deedDef = resolveDeedType(state.documentType);
  const templateAvailable = isDeedTemplateAvailable(state.documentType);
  const { deed: compiledDeed, error: compileError } = tryCompileDeedDocument(state, docNo);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4500);
  };

  const handleExportPDF = async () => {
    if (!templateAvailable || !compiledDeed) {
      showNotification('error', compileError || 'Template unavailable: Export is blocked.');
      return;
    }
    setGeneratingType('pdf');
    try {
      const res = await generateCanonicalPDF(state, docNo, { containerElementId: 'deed-preview-sheet' });
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
      showNotification('error', compileError || 'Template unavailable: Export is blocked.');
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

  const printDocument = () => {
    if (!templateAvailable || !compiledDeed) {
      showNotification('error', compileError || 'Template unavailable: Printing is blocked.');
      return;
    }
    const printContent = sanitizeHtml(previewRef.current?.innerHTML || '');
    const windowUrl = 'about:blank';
    const uniqueName = new Date().getTime();
    const windowName = `PrintWindow_${uniqueName}`;
    const PrintWindow = window.open(windowUrl, windowName, 'width=900,height=650');
    if (PrintWindow) {
      PrintWindow.document.write(`
        <html>
          <head>
            <title>Draft Deed - Preview</title>
            <style>${tamilPrintFontCss(window.location.origin)}
              body { font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; }
              .stamp-header { border: 3px double #334155; padding: 20px; text-align: center; margin-bottom: 30px; }
              .bilingual-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px; }
              .tamil { font-family: 'Noto Sans Tamil', sans-serif; font-size: 13px; }
              .english { font-size: 14px; }
              .section-title { font-weight: bold; text-decoration: underline; text-align: center; margin-top: 25px; margin-bottom: 15px; }
              .page-break { page-break-after: always; }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      PrintWindow.document.close();
      PrintWindow.focus();
      void (async () => {
        await PrintWindow.document.fonts.load('400 12px "Noto Sans Tamil"', 'தமிழ்');
        await PrintWindow.document.fonts.load('700 12px "Noto Sans Tamil"', 'தமிழ்');
        await PrintWindow.document.fonts.ready;
        PrintWindow.onafterprint = () => PrintWindow.close();
        PrintWindow.print();
      })().catch(() => showNotification('error', 'Tamil print font could not load. Please retry.'));
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl flex flex-col h-full overflow-hidden shadow-inner relative">
      {/* Toast Feedback notification */}
      {feedback && (
        <div 
          className={`absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-bold shadow-xl border flex items-center gap-2 ${
            feedback.type === 'success' 
              ? 'bg-emerald-900 text-emerald-100 border-emerald-700' 
              : 'bg-rose-900 text-rose-100 border-rose-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Control Bar */}
      <div className="bg-white px-5 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="h-4.5 w-4.5 text-slate-500" />
          <span className="text-sm font-bold text-slate-700">Live Deed Preview Pane</span>
          {templateAvailable ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 border border-amber-200">
              DRAFT PREVIEW
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-700 border border-rose-200">
              TEMPLATE UNAVAILABLE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={printDocument}
            disabled={!templateAvailable}
            className="p-1.5 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded text-slate-600 transition"
            title="Print draft deed"
          >
            <Printer className="h-4 w-4" />
          </button>

          <button
            onClick={handleExportPDF}
            disabled={generatingType !== null || !templateAvailable}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white rounded transition shadow-sm cursor-pointer"
            title="Generate draft PDF"
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c49a36] hover:bg-[#a57a20] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white rounded transition shadow-sm cursor-pointer"
            title="Generate draft DOCX"
          >
            {generatingType === 'docx' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
            ) : (
              <Download className="h-3.5 w-3.5 text-white" />
            )}
            <span>Generate DOCX</span>
          </button>
        </div>
      </div>

      {/* Preview Sheet Container */}
      <div className="flex-1 p-6 overflow-y-auto flex justify-center bg-slate-100/50">
        {!templateAvailable || !compiledDeed ? (
          <div className="w-full max-w-[680px] bg-white border border-rose-200 rounded-xl shadow-sm p-10 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800">
              Template unavailable
            </h3>
            <p className="text-xs text-slate-600 max-w-md leading-relaxed">
              {compileError ||
                `The selected document type "${deedDef?.nameEn || state.documentType || 'Unknown'}" does not have an implemented legal template. Document generation and export are blocked.`}
            </p>
          </div>
        ) : (
          <div 
            ref={previewRef}
            id="deed-preview-sheet"
            className="w-full max-w-[800px] bg-white border border-slate-300 rounded-lg shadow-lg p-10 font-serif text-slate-800 text-left min-h-[1100px] flex flex-col selection:bg-emerald-100"
          >
            {/* DRAFT DEED HEADER */}
            <div className="border-[4px] border-double border-slate-700 p-4 mb-4 flex flex-col items-center bg-slate-50 rounded relative overflow-hidden">
              <div className="absolute top-0 right-0 left-0 h-1.5 bg-slate-700" />
              
              <div className="text-center font-serif text-slate-800 tracking-wider">
                <p className="text-[10px] font-bold uppercase leading-none text-slate-600">
                  DRAFT LEGAL INSTRUMENT • FOR EXECUTION & SUB-REGISTRAR PRESENTATION
                </p>
                <h2 className="text-2xl font-extrabold tracking-widest mt-1 mb-1 font-serif text-slate-900">
                  {compiledDeed.metadata.deedNameEn.toUpperCase()}
                </h2>
                <p className="text-[10px] font-bold text-slate-600">
                  பத்திர வரைவு • அரசுப் பதிவுச் சான்றிதழ் அல்ல (UNREGISTERED DRAFT)
                </p>
              </div>

              <div className="w-full border-t border-dashed border-slate-400 my-3" />

              <div className="flex justify-between w-full text-xs font-mono font-bold text-slate-700 px-4">
                <span>TARGET SRO: {state.property.sro || '————'}</span>
                <span>DRAFT REF: {compiledDeed.metadata.docNo}</span>
                <span>DECLARED VAL: {formatIndianCurrency(state.transaction.marketValue || 0)}</span>
              </div>
            </div>

            {/* Engine Versioning & Timestamp */}
            <div className="bg-slate-50 border border-slate-200/60 rounded px-3 py-1.5 mb-6 flex justify-between items-center text-[9px] font-mono text-slate-400">
              <span>ENGINE: {compiledDeed.metadata.templateVersion}</span>
              <span>GEN TIME: {new Date(compiledDeed.metadata.generatedAt).toLocaleString()} (UTC)</span>
              <span>REV: #{compiledDeed.metadata.revisionNo}</span>
            </div>

            {/* DYNAMIC BILINGUAL SECTIONS */}
            <div className="space-y-6 flex-1">
              {compiledDeed.sections.map((section) => {
                const isTitle = section.id === 'title';
                const isSignatures = section.id === 'signatures';
                
                if (isTitle) {
                  return (
                    <div key={section.id} className="text-center border-b border-slate-200 pb-4 mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="font-sans text-slate-800" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentTa) }} />
                        <div className="font-serif text-slate-800" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentEn) }} />
                      </div>
                    </div>
                  );
                }

                if (isSignatures) {
                  return (
                    <div key={section.id} className="pt-6 border-t border-slate-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-[9px] text-slate-400 font-bold mb-2 uppercase tracking-wider font-sans">Tamil Signatures / தமிழ் கையொப்பங்கள்</p>
                          <div className="font-sans text-slate-800" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentTa) }} />
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 font-bold mb-2 uppercase tracking-wider font-sans">English Signatures / ஆங்கில கையொப்பங்கள்</p>
                          <div className="font-serif text-slate-800" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentEn) }} />
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={section.id} className="border-b border-slate-100 pb-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-100/40 px-2 py-0.5 rounded font-mono">
                        {section.titleEn} / {section.titleTa}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="font-sans text-xs text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentTa) }} />
                      <div className="font-serif text-xs text-slate-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.contentEn) }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Draft Preparation Footer */}
            <div className="mt-8 border-t border-slate-150 pt-4 flex justify-between items-center text-[10px] font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <div className="border border-slate-400/50 text-slate-500 rounded-full w-10 h-10 flex flex-col items-center justify-center text-[6px] font-sans pointer-events-none uppercase font-bold tracking-widest p-1">
                  <ShieldCheck className="h-3.5 w-3.5 mb-0.5 text-slate-500" />
                  <span>DRAFT</span>
                </div>
                <div>
                  <p className="text-slate-500 font-semibold uppercase">UNREGISTERED DRAFT RECORD</p>
                  <p className="text-[8px] text-slate-400">DRAFT REF: {compiledDeed.metadata.docNo}</p>
                </div>
              </div>
              <div className="text-right">
                <p>PAGE 1 OF 1</p>
                <p className="text-[8px]">FOR EXECUTION & SRO SUBMISSION</p>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
