import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle, Header, Footer, PageNumber, NumberFormat } from 'docx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { DeedWizardState, SavedDraft } from '../types';
import { compileDeedDocument, LegalSection } from './documentGenerator';
import { formatIndianCurrency } from './amountFormatter';
import { sanitizeHtml } from './htmlSanitizer';

/**
 * Utility to strip HTML tags and decode entities into plain text
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  const safe = sanitizeHtml(html);
  if (typeof document === 'undefined') {
    return safe.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  }
  const tmp = document.createElement('DIV');
  tmp.innerHTML = safe;
  return tmp.textContent || tmp.innerText || '';
}

type DocxAlignment = (typeof AlignmentType)[keyof typeof AlignmentType];

/**
 * Helper to convert HTML string with basic formatting (strong, b, p, br, li) into docx TextRuns & Paragraphs
 */
function htmlToDocxParagraphs(html: string, options?: { isTamil?: boolean; size?: number; align?: DocxAlignment }): Paragraph[] {
  if (!html) return [new Paragraph({ text: '' })];

  if (typeof DOMParser === 'undefined') {
    const plain = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: plain,
            font: options?.isTamil ? 'Arial Unicode MS, Nirmala UI, sans-serif' : 'Times New Roman',
            size: options?.size || 22
          })
        ],
        alignment: options?.align || AlignmentType.LEFT
      })
    ];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstElementChild || doc.body;

  const paragraphs: Paragraph[] = [];
  const defaultFont = options?.isTamil ? 'Arial Unicode MS, Nirmala UI, Latha, sans-serif' : 'Times New Roman';
  const defaultSize = options?.size || (options?.isTamil ? 20 : 22); // half-points (22 = 11pt, 20 = 10pt)

  function processNode(node: Node, currentRuns: TextRun[], listPrefix = ''): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        currentRuns.push(
          new TextRun({
            text: listPrefix + text,
            font: defaultFont,
            size: defaultSize
          })
        );
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'p' || tag === 'div' || tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
        const pRuns: TextRun[] = [];
        const isHeading = tag.startsWith('h');
        const isCenter = el.classList.contains('text-center') || el.style.textAlign === 'center';

        el.childNodes.forEach((child) => processNode(child, pRuns));

        if (pRuns.length > 0) {
          paragraphs.push(
            new Paragraph({
              children: pRuns,
              alignment: isCenter ? AlignmentType.CENTER : (options?.align || AlignmentType.JUSTIFIED),
              spacing: { after: 120, line: 280 }
            })
          );
        }
      } else if (tag === 'ul' || tag === 'ol') {
        let itemIndex = 1;
        el.childNodes.forEach((child) => {
          if (child.nodeName.toLowerCase() === 'li') {
            const liRuns: TextRun[] = [];
            const prefix = tag === 'ol' ? `${itemIndex++}. ` : '• ';
            child.childNodes.forEach((liChild) => processNode(liChild, liRuns, liRuns.length === 0 ? prefix : ''));
            if (liRuns.length > 0) {
              paragraphs.push(
                new Paragraph({
                  children: liRuns,
                  indent: { left: 360 },
                  spacing: { after: 80, line: 260 }
                })
              );
            }
          }
        });
      } else if (tag === 'strong' || tag === 'b') {
        const boldText = el.textContent || '';
        if (boldText) {
          currentRuns.push(
            new TextRun({
              text: listPrefix + boldText,
              bold: true,
              font: defaultFont,
              size: defaultSize
            })
          );
        }
      } else if (tag === 'em' || tag === 'i') {
        const italicsText = el.textContent || '';
        if (italicsText) {
          currentRuns.push(
            new TextRun({
              text: listPrefix + italicsText,
              italics: true,
              font: defaultFont,
              size: defaultSize
            })
          );
        }
      } else if (tag === 'u') {
        const uText = el.textContent || '';
        if (uText) {
          currentRuns.push(
            new TextRun({
              text: listPrefix + uText,
              underline: {},
              font: defaultFont,
              size: defaultSize
            })
          );
        }
      } else if (tag === 'br') {
        currentRuns.push(new TextRun({ break: 1 }));
      } else {
        el.childNodes.forEach((child) => processNode(child, currentRuns, listPrefix));
      }
    }
  }

  // Check top-level elements
  let directRuns: TextRun[] = [];
  container.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as HTMLElement).tagName.toLowerCase();
      if (['p', 'div', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4'].includes(tag)) {
        if (directRuns.length > 0) {
          paragraphs.push(
            new Paragraph({
              children: directRuns,
              alignment: options?.align || AlignmentType.JUSTIFIED,
              spacing: { after: 120, line: 280 }
            })
          );
          directRuns = [];
        }
        processNode(node, []);
        return;
      }
    }
    processNode(node, directRuns);
  });

  if (directRuns.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: directRuns,
        alignment: options?.align || AlignmentType.JUSTIFIED,
        spacing: { after: 120, line: 280 }
      })
    );
  }

  return paragraphs.length > 0 ? paragraphs : [new Paragraph({ text: stripHtml(html) })];
}

/**
 * Downloads a binary Blob to the user's browser
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * GENERATE REAL OPENXML DOCX FILE
 * Uses 'docx' library to construct a compliant Word document (.docx)
 */
export async function generateCanonicalDOCX(
  state: DeedWizardState,
  docNo: string = 'DEED/2026/0142'
): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }> {
  try {
    const compiledDeed = compileDeedDocument(state, docNo);
    const sroName = state.property.sro || 'Chennai Central SRO';
    const marketVal = formatIndianCurrency(state.transaction.marketValue || 0);

    const tableBorderConfig = {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' }
    };

    // Construct DOCX Sections
    const docChildren: (Paragraph | Table)[] = [];

    // 1. DRAFT DEED HEADER TABLE (Never claims to be an official government e-stamp)
    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.DOUBLE, size: 3, color: '334155' },
          bottom: { style: BorderStyle.DOUBLE, size: 3, color: '334155' },
          left: { style: BorderStyle.DOUBLE, size: 3, color: '334155' },
          right: { style: BorderStyle.DOUBLE, size: 3, color: '334155' },
          insideHorizontal: { style: BorderStyle.DASHED, size: 1, color: '64748B' },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                margins: { top: 180, bottom: 180, left: 240, right: 240 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: 'DRAFT DEED FOR EXECUTION & PRESENTATION — NOT A GOVERNMENT REGISTRATION CERTIFICATE',
                        bold: true,
                        size: 18,
                        color: '1E293B',
                        font: 'Times New Roman'
                      })
                    ]
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: compiledDeed.metadata.deedNameEn.toUpperCase(),
                        bold: true,
                        size: 28,
                        color: '0F172A',
                        font: 'Times New Roman'
                      })
                    ]
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: 'பத்திர வரைவு — சார்பதிவாளர் அலுவலகத்தில் தாக்கல் செய்வதற்கான ஆவணம் (அரசுப் பதிவுச் சான்றிதழ் அல்ல)',
                        bold: true,
                        size: 16,
                        color: '334155',
                        font: 'Arial Unicode MS, Nirmala UI, sans-serif'
                      })
                    ]
                  })
                ]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                margins: { top: 100, bottom: 100, left: 240, right: 240 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.BOTH,
                    children: [
                      new TextRun({ text: `TARGET SRO: ${sroName}   |   `, bold: true, size: 16, color: '334155' }),
                      new TextRun({ text: `DRAFT REF: ${docNo}   |   `, bold: true, size: 16, color: '334155' }),
                      new TextRun({ text: `DECLARED MARKET VALUE: ${marketVal}`, bold: true, size: 16, color: '334155' })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      })
    );

    // Spacer
    docChildren.push(new Paragraph({ spacing: { after: 200 } }));

    // 2. DOCUMENT SECTIONS
    for (const section of compiledDeed.sections) {
      // Section Heading
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: `${section.titleEn.toUpperCase()} / ${section.titleTa}`,
              bold: true,
              size: 22,
              color: '047857',
              font: 'Times New Roman'
            })
          ]
        })
      );

      // Section Content in 2-Column Bilingual Table
      const englishParagraphs = htmlToDocxParagraphs(section.contentEn, { isTamil: false, size: 20 });
      const tamilParagraphs = htmlToDocxParagraphs(section.contentTa, { isTamil: true, size: 19 });

      docChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorderConfig,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  margins: { top: 120, bottom: 120, left: 160, right: 160 },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: 'TAMIL TEXT (தமிழ் வடிவம்)',
                          bold: true,
                          size: 16,
                          color: '475569',
                          font: 'Arial Unicode MS, Nirmala UI, sans-serif'
                        })
                      ],
                      spacing: { after: 100 }
                    }),
                    ...tamilParagraphs
                  ]
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  margins: { top: 120, bottom: 120, left: 160, right: 160 },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: 'ENGLISH TEXT (ஆங்கில வடிவம்)',
                          bold: true,
                          size: 16,
                          color: '475569',
                          font: 'Times New Roman'
                        })
                      ],
                      spacing: { after: 100 }
                    }),
                    ...englishParagraphs
                  ]
                })
              ]
            })
          ]
        })
      );

      docChildren.push(new Paragraph({ spacing: { after: 140 } }));
    }

    // 3. DRAFT PREPARATION METADATA TABLE
    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: '475569' },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: '475569' },
          left: { style: BorderStyle.SINGLE, size: 2, color: '475569' },
          right: { style: BorderStyle.SINGLE, size: 2, color: '475569' },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' }
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                margins: { top: 140, bottom: 140, left: 180, right: 180 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'DRAFT PREPARATION RECORD (UNREGISTERED)',
                        bold: true,
                        size: 18,
                        color: '1E293B'
                      })
                    ]
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Draft Ref: ${docNo}\nPrepared Date: ${state.transaction.paymentDate || new Date().toISOString().split('T')[0]}\nStatus: Unregistered Draft — Subject to Sub-Registrar Execution`,
                        size: 16,
                        color: '334155'
                      })
                    ]
                  })
                ]
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                margins: { top: 140, bottom: 140, left: 180, right: 180 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'DOCUMENT WRITER / LEGAL COUNSEL BLOCK',
                        bold: true,
                        size: 18,
                        color: '1E293B'
                      })
                    ]
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Drafted via DEEDOS360 Legal Engine\nNotice: App finalization does not constitute government registration under the Registration Act, 1908.`,
                        size: 16,
                        color: '334155'
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      })
    );

    // Build the OpenXML Document Package
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch in twips
                bottom: 1440,
                left: 1440,
                right: 1440
              }
            }
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: `UNREGISTERED DEED DRAFT — ${docNo}`,
                      font: 'Times New Roman',
                      size: 16,
                      color: '64748B'
                    })
                  ]
                })
              ]
            })
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.BOTH,
                  children: [
                    new TextRun({
                      text: 'DEEDOS360 DRAFT EXPORT (NOT A REGISTRATION CERTIFICATE)   |   PAGE ',
                      font: 'Times New Roman',
                      size: 16,
                      color: '64748B'
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      font: 'Times New Roman',
                      size: 16,
                      color: '64748B'
                    }),
                    new TextRun({
                      text: ' OF ',
                      font: 'Times New Roman',
                      size: 16,
                      color: '64748B'
                    }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      font: 'Times New Roman',
                      size: 16,
                      color: '64748B'
                    })
                  ]
                })
              ]
            })
          },
          children: docChildren
        }
      ]
    });

    // Package to binary Blob
    const blob = await Packer.toBlob(doc);

    if (!blob || blob.size === 0) {
      throw new Error('Generated DOCX binary has 0 bytes.');
    }

    const safeDocName = docNo.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeDocName}_draft_deed.docx`;

    // Trigger download
    downloadBlob(blob, filename);

    return {
      success: true,
      blob,
      filename
    };
  } catch (err: any) {
    console.error('Real DOCX export failed:', err);
    return {
      success: false,
      error: err.message || 'Failed to generate genuine DOCX OpenXML file.'
    };
  }
}

/**
 * GENERATE REAL MULTI-PAGE PDF FILE
 * Renders high-fidelity A4 document using jsPDF + html2canvas with browser-rendered Tamil glyphs
 */
export async function generateCanonicalPDF(
  state: DeedWizardState,
  docNo: string = 'DEED/2026/0142',
  options?: {
    containerElementId?: string;
    paperSize?: 'A4' | 'Legal';
    showToast?: boolean;
  }
): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }> {
  try {
    const compiledDeed = compileDeedDocument(state, docNo);
    const paper = options?.paperSize || 'A4';
    const pageWidthMm = paper === 'A4' ? 210 : 215.9;
    const pageHeightMm = paper === 'A4' ? 297 : 355.6;

    // Check if we have an existing rendered container or need to build an off-screen high-res container
    let sourceElement: HTMLElement | null = null;
    let createdTemporary = false;

    if (typeof document === 'undefined') {
      return { success: false, error: 'PDF export requires a browser rendering environment. Open the document preview in the app to export a PDF.' };
    }

    if (!sourceElement) {
      // Build standalone printable DOM tree with full CSS styling and Tamil fonts
      createdTemporary = true;
      sourceElement = document.createElement('div');
      sourceElement.id = 'pdf-render-temp-container';
      sourceElement.style.position = 'absolute';
      sourceElement.style.left = '-9999px';
      sourceElement.style.top = '0';
      sourceElement.style.width = '794px'; // ~210mm at 96 DPI
      sourceElement.style.backgroundColor = '#ffffff';
      sourceElement.style.color = '#000000';
      sourceElement.style.fontFamily = "'Times New Roman', serif";
      sourceElement.style.padding = '30px';

      const sroName = state.property.sro || '————';
      const marketVal = formatIndianCurrency(state.transaction.marketValue || 0);

      const htmlContent = `
        <div style="font-family: 'Times New Roman', serif; color: #1e293b;">
          <!-- DRAFT HEADER BANNER -->
          <div style="border: 3px double #334155; background-color: #f8fafc; padding: 16px; text-align: center; margin-bottom: 24px; border-radius: 6px;">
            <p style="font-size: 10px; font-weight: bold; color: #334155; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; font-family: 'Noto Sans Tamil', sans-serif;">DRAFT DEED FOR EXECUTION & PRESENTATION — NOT A GOVERNMENT REGISTRATION CERTIFICATE</p>
            <h1 style="font-size: 20px; font-weight: 900; color: #0f172a; margin: 4px 0; letter-spacing: 0.08em;">${compiledDeed.metadata.deedNameEn.toUpperCase()}</h1>
            <p style="font-size: 9px; font-weight: bold; color: #475569; margin: 0; font-family: 'Noto Sans Tamil', 'Nirmala UI', sans-serif;">பத்திர வரைவு • அரசுப் பதிவுச் சான்றிதழ் அல்ல</p>
            <div style="border-top: 1px dashed #64748b; margin: 8px 0; opacity: 0.4;"></div>
            <div style="display: flex; justify-content: space-between; font-size: 9px; font-family: 'Noto Sans Tamil', monospace; font-weight: bold; color: #334155; padding: 0 8px;">
              <span>TARGET SRO: ${sroName}</span>
              <span>DRAFT REF: ${docNo}</span>
              <span>DECLARED VALUE: ${marketVal}</span>
            </div>
          </div>

          <!-- SECTIONS -->
          <div style="display: flex; flex-direction: column; gap: 18px;">
            ${compiledDeed.sections
              .map((section) => {
                const isTitle = section.id === 'title';
                const isSignatures = section.id === 'signatures';

                if (isTitle) {
                  return `
                    <div class="export-section" style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 12px;">
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div style="font-family: 'Noto Sans Tamil', 'Nirmala UI', sans-serif; font-size: 13px; font-weight: bold; color: #0f172a;">${section.contentTa}</div>
                        <div style="font-family: 'Times New Roman', serif; font-size: 14px; font-weight: bold; color: #0f172a;">${section.contentEn}</div>
                      </div>
                    </div>
                  `;
                }

                if (isSignatures) {
                  return `
                    <div class="export-section" style="border-top: 2px solid #cbd5e1; padding-top: 16px; margin-top: 20px;">
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                        <div>
                          <p style="font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 6px; font-family: 'Noto Sans Tamil', sans-serif;">தமிழ் கையொப்பங்கள்</p>
                          <div style="font-family: 'Noto Sans Tamil', 'Nirmala UI', sans-serif; font-size: 11px;">${section.contentTa}</div>
                        </div>
                        <div>
                          <p style="font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 6px; font-family: 'Noto Sans Tamil', sans-serif;">ENGLISH SIGNATURES</p>
                          <div style="font-family: 'Times New Roman', serif; font-size: 11px;">${section.contentEn}</div>
                        </div>
                      </div>
                    </div>
                  `;
                }

                return `
                  <div class="export-section" style="border-bottom: 1px solid #f1f5f9; padding-bottom: 14px;">
                    <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #047857; background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px; font-family: 'Noto Sans Tamil', monospace;">
                      ${section.titleEn} / ${section.titleTa}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 11px; line-height: 1.6;">
                      <div style="font-family: 'Noto Sans Tamil', 'Nirmala UI', sans-serif; text-align: justify; color: #1e293b;">${section.contentTa}</div>
                      <div style="font-family: 'Times New Roman', serif; text-align: justify; color: #0f172a;">${section.contentEn}</div>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>

          <!-- DRAFT FOOTER -->
          <div style="margin-top: 24px; border-top: 1px solid #cbd5e1; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; font-family: 'Noto Sans Tamil', monospace; color: #64748b;">
            <div>
              <p style="font-weight: bold; color: #0f172a; margin: 0;">UNREGISTERED DRAFT — FOR SRO PRESENTATION ONLY</p>
              <p style="margin: 2px 0 0 0;">DRAFT REF: ${docNo} • NOT A GOVERNMENT REGISTRATION CERTIFICATE</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0;">DEEDOS360 DRAFT EXPORT</p>
              <p style="margin: 2px 0 0 0;">GENERATED: ${new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      `;

      sourceElement.innerHTML = sanitizeHtml(htmlContent);
      document.body.appendChild(sourceElement);
    }

    let canvas: HTMLCanvasElement;
    let sectionBounds: { top: number; bottom: number }[] = [];
    let sourceWidth = 1;
    try {
      // Wait for Tamil glyphs before capturing; never render missing-glyph boxes.
      await document.fonts.load('400 12px "Noto Sans Tamil"', 'தமிழ்');
      await document.fonts.load('700 12px "Noto Sans Tamil"', 'தமிழ்');
      await document.fonts.ready;
      const sourceBounds = sourceElement.getBoundingClientRect();
      sourceWidth = sourceBounds.width;
      sectionBounds = Array.from(sourceElement.querySelectorAll('.export-section')).map(element => {
        const bounds = element.getBoundingClientRect();
        return { top: bounds.top - sourceBounds.top, bottom: bounds.bottom - sourceBounds.top };
      });
      canvas = await html2canvas(sourceElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
    } finally {
      if (createdTemporary && sourceElement?.isConnected) sourceElement.remove();
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: paper === 'A4' ? 'a4' : 'legal'
    });

    // Paginate actual image strips at whitespace, rather than clipping a tall
    // image at arbitrary page boundaries through a line of text.
    const marginMm = 8;
    const contentWidthMm = pageWidthMm - marginMm * 2;
    const usableHeightMm = pageHeightMm - marginMm * 2 - 4;
    const pixelsPerMm = canvas.width / contentWidthMm;
    const maxStripHeight = Math.floor(usableHeightMm * pixelsPerMm);
    const sourceContext = canvas.getContext('2d');
    if (!sourceContext) throw new Error('Unable to read document canvas.');
    // Trim trailing white padding so a few overflow pixels cannot create a blank page.
    let contentHeight = canvas.height;
    for (let y = canvas.height - 1; y >= 0; y--) {
      const row = sourceContext.getImageData(0, y, canvas.width, 1).data;
      let ink = 0;
      for (let x = 0; x < canvas.width; x++) {
        const i = x * 4;
        if (row[i] + row[i + 1] + row[i + 2] < 720) ink++;
      }
      if (ink / canvas.width > 0.002) { contentHeight = Math.min(y + 2, canvas.height); break; }
    }
    let offset = 0;
    let pageNumber = 1;
    while (offset < contentHeight) {
      let end = Math.min(offset + maxStripHeight, contentHeight);
      if (end < contentHeight) {
        const scale = canvas.width / sourceWidth;
        const crossing = sectionBounds.find(block => block.top * scale > offset + maxStripHeight * 0.4 && block.top * scale < end && block.bottom * scale > end && (block.bottom - block.top) * scale <= maxStripHeight);
        if (crossing) end = Math.floor(crossing.top * scale);
        const minCut = offset + Math.floor(maxStripHeight * 0.82);
        let blankRows = 0;
        for (let y = end - 1; y >= minCut; y--) {
          const row = sourceContext.getImageData(0, y, canvas.width, 1).data;
          let ink = 0;
          for (let x = 0; x < canvas.width; x++) {
            const i = x * 4;
            if (row[i] + row[i + 1] + row[i + 2] < 660) ink++;
          }
          blankRows = ink / canvas.width < 0.004 ? blankRows + 1 : 0;
          if (blankRows >= 3) { end = y + 1; break; }
        }
      }
      const strip = document.createElement('canvas');
      strip.width = canvas.width;
      strip.height = end - offset;
      const context = strip.getContext('2d');
      if (!context || strip.height <= 0) throw new Error('Unable to paginate document.');
      context.drawImage(canvas, 0, offset, canvas.width, strip.height, 0, 0, strip.width, strip.height);
      if (pageNumber > 1) pdf.addPage();
      pdf.addImage(strip.toDataURL('image/jpeg', 0.95), 'JPEG', marginMm, marginMm, contentWidthMm, strip.height / pixelsPerMm);
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text(`Draft - Page ${pageNumber}`, pageWidthMm - marginMm, pageHeightMm - 5, { align: 'right' });
      offset = end;
      pageNumber++;
    }

    // Generate real PDF binary Blob
    const blob = pdf.output('blob');

    if (!blob || blob.size === 0) {
      throw new Error('Generated PDF binary has 0 bytes.');
    }

    const safeDocName = docNo.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeDocName}_final_deed.pdf`;

    // Trigger download
    downloadBlob(blob, filename);

    return {
      success: true,
      blob,
      filename
    };
  } catch (err: any) {
    console.error('Real PDF export failed:', err);
    return {
      success: false,
      error: err.message || 'Failed to generate genuine PDF file.'
    };
  }
}
