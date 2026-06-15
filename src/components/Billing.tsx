import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { ArrowLeft, Plus, Trash2, X, CheckCircle2, FileText, Settings, Download } from 'lucide-react';
import { Bill, BillItem, PDFSettings, DEFAULT_PDF_SETTINGS } from '../types/billing';
import { numberToWords } from '../utils/numberToWords';
import { db, auth } from '../firebase';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Error caught: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const generateBillPDF = async (bill: Bill, action: 'download' | 'view' | 'blob' | 'share' = 'download', settings: PDFSettings = DEFAULT_PDF_SETTINGS) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  };

  const headerBgRgb = hexToRgb(settings.headerBgColor);
  const headerTextRgb = hexToRgb(settings.headerTextColor);
  const footerBgRgb = hexToRgb(settings.footerBgColor);
  const footerTextRgb = hexToRgb(settings.footerTextColor);

  doc.setTextColor(220, 220, 220);
  doc.setFontSize(55);
  doc.setFont(settings.fontStyle, 'bold');
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.12 })); 
  
  doc.text(settings.companyName, 155, 230, { align: 'center', angle: 45 });
  
  doc.restoreGraphicsState();

  if (settings.headerBgColor.toUpperCase() !== '#FFFFFF') {
    doc.setFillColor(headerBgRgb[0], headerBgRgb[1], headerBgRgb[2]);
    doc.rect(0, 0, 210, 35, 'F'); 
  }

  if (settings.logo) {
    try {
      const isWideLogo = settings.hideNameText;
      const logoWidth = isWideLogo ? 160 : 40;
      const logoHeight = isWideLogo ? 13.33 : 13.33;
      const logoX = isWideLogo ? (210 - logoWidth) / 2 : 20;
      const logoY = isWideLogo ? 10 : 10;
      doc.addImage(settings.logo, 'PNG', logoX, logoY, logoWidth, logoHeight);
    } catch (e) {
      console.error("Error adding logo to PDF", e);
    }
  }

  if (!settings.hideNameText) {
    doc.setTextColor(headerTextRgb[0], headerTextRgb[1], headerTextRgb[2]);
    doc.setFontSize(24);
    doc.setFont(settings.fontStyle, 'bold'); 
    const nameX = settings.logo ? 60 : 105;
    const textAlign = settings.logo ? 'left' : 'center';
    doc.text(settings.companyName, nameX, 22, { align: textAlign as any });
  }
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont(settings.fontStyle, 'normal');
  doc.text(`To,`, 20, 40);
  doc.text(`Dear Sir,`, 20, 45);
  doc.setFont(settings.fontStyle, 'bold');
  doc.text(bill.recipientName, 20, 50);
  
  doc.setFont(settings.fontStyle, 'normal');
  doc.text(`Date: ${new Date(bill.date).toLocaleDateString('en-GB')}`, 190, 40, { align: 'right' });
  doc.setFont(settings.fontStyle, 'bold');
  doc.text(`Ref: ${bill.billNumber}${bill.revision && bill.revision > 0 ? ` (${bill.revision})` : ''}`, 190, 45, { align: 'right' });

  doc.setFontSize(16);
  doc.setFont(settings.fontStyle, 'bold');
  doc.text(bill.type, 105, 60, { align: 'center' });
  
  const titleWidth = doc.getTextWidth(bill.type);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(105 - (titleWidth / 2), 62, 105 + (titleWidth / 2), 62);

  doc.setFontSize(10);
  doc.setFont(settings.fontStyle, 'bold');
  doc.text(`Site: `, 20, 70);
  doc.setFont(settings.fontStyle, 'normal');
  doc.text(bill.site, 30, 70);

  doc.setFont(settings.fontStyle, 'bold');
  doc.text(`Sub: `, 20, 80);
  doc.text(bill.subject, 30, 80);

  const tableData = bill.items.map((item, index) => [
    index + 1,
    item.areaName,
    item.tiles,
    item.qty,
    item.unit,
    item.price.toFixed(2),
    item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })
  ]);

  autoTable(doc, {
    startY: 90,
    head: [['SL', 'Area Name', 'Tiles', 'Qty', 'Unit', 'Price', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, halign: 'center', font: settings.fontStyle },
    styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1, font: settings.fontStyle, textColor: [40, 40, 40] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 60 },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 30, halign: 'right' }
    },
    foot: [[
      { content: `In word: ${bill.totalInWords}`, colSpan: 6, styles: { fontStyle: 'bold', font: settings.fontStyle as any } },
      { content: `Tk. ${bill.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', halign: 'right', font: settings.fontStyle as any } }
    ]],
    footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1 }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 150;

  doc.setFontSize(10);
  const signatureCenterX = 170;
  doc.setFont(settings.fontStyle, 'normal');
  doc.text('Best regards', signatureCenterX, finalY + 20, { align: 'center' });
  
  if (bill.signature) {
    try {
      doc.addImage(bill.signature, 'PNG', signatureCenterX - 15, finalY + 22, 30, 15);
    } catch (e) {
      console.error("Error adding signature to PDF", e);
    }
  }

  doc.setFont(settings.fontStyle, 'bold');
  // Handle empty or missing preparedBy properly
  doc.text(bill.preparedBy || '', signatureCenterX, finalY + 40, { align: 'center' });

  if (bill.termsAndConditions) {
    doc.setFontSize(9);
    doc.setFont(settings.fontStyle, 'bold');
    doc.text('Terms & Conditions:', 20, finalY + 20);
    doc.setFont(settings.fontStyle, 'normal');
    const splitTerms = doc.splitTextToSize(bill.termsAndConditions, 120);
    doc.text(splitTerms, 20, finalY + 25);
  }

  if (settings.footerBgColor.toUpperCase() !== '#FFFFFF') {
    doc.setFillColor(footerBgRgb[0], footerBgRgb[1], footerBgRgb[2]);
    doc.rect(0, 280, 210, 17, 'F');
  }

  doc.setTextColor(footerTextRgb[0], footerTextRgb[1], footerTextRgb[2]);
  doc.setFontSize(8);
  doc.setFont(settings.fontStyle, 'normal');
  doc.text(`Address: ${settings.address} Email: ${settings.email}`, 105, 287, { align: 'center' });
  doc.text(`Contact: ${settings.contact}`, 105, 292, { align: 'center' });

  const fileName = `${bill.type}_${bill.billNumber}.pdf`;
  const isCapacitor = (window as any).Capacitor?.isNativePlatform();

  if (isCapacitor) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const result = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache,
      });

      if (action === 'share') {
        await Share.share({
          title: `${bill.type} - ${bill.recipientName}`,
          text: `Please find the ${bill.type.toLowerCase()} attached.`,
          url: result.uri,
          dialogTitle: `Share ${bill.type}`,
        });
      } else {
        await Share.share({
          title: fileName,
          url: result.uri,
        });
      }
    } catch (e) {
      console.error('Capacitor PDF Error:', e);
      if (action === 'download') doc.save(fileName);
    }
  } else {
    if (action === 'download') {
      doc.save(fileName);
    } else if (action === 'view') {
      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank');
    } else if (action === 'share') {
      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: `${bill.type} - ${bill.recipientName}`,
          text: `Please find the ${bill.type.toLowerCase()} attached.`
        });
      } else {
        doc.save(fileName);
      }
    }
  }
  
  return doc;
};

export function PDFSettingsView({ settings, onSave, onBack }: { settings: PDFSettings, onSave: (s: PDFSettings) => void, onBack: () => void }) {
  const [form, setForm] = useState<PDFSettings>(settings);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm({ ...form, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1 hover:bg-[#F5F5F5] rounded-full transition-colors cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold border-b-2 border-[#0D47A1] inline-block pb-1">PDF Customization</h2>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-md border border-[#B0BEC5] space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-bold text-[#0D47A1] border-b pb-2">Company Information</h3>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#78909C] uppercase">Company Name</label>
              <input 
                type="text" 
                value={form.companyName} 
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="w-full p-2 border border-[#B0BEC5] rounded bg-[#F5F9FD] text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#78909C] uppercase">Address</label>
              <textarea 
                value={form.address} 
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full p-2 border border-[#B0BEC5] rounded bg-[#F5F9FD] text-sm h-20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#78909C] uppercase">Email</label>
              <input 
                type="email" 
                value={form.email} 
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full p-2 border border-[#B0BEC5] rounded bg-[#F5F9FD] text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#78909C] uppercase">Contact Number</label>
              <input 
                type="text" 
                value={form.contact} 
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                className="w-full p-2 border border-[#B0BEC5] rounded bg-[#F5F9FD] text-sm"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-[#0D47A1] border-b pb-2">Visual Customization</h3>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#78909C] uppercase">Company Logo</label>
              <div className="flex items-center gap-4">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="text-xs cursor-pointer"
                />
                {form.logo && (
                  <div className="relative group">
                    <img src={form.logo} alt="Logo" className="h-12 border border-[#B0BEC5] rounded" />
                    <button 
                      onClick={() => setForm({ ...form, logo: undefined })}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-md"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="hideNameText"
                  checked={form.hideNameText}
                  onChange={(e) => setForm({ ...form, hideNameText: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="hideNameText" className="text-xs font-medium text-[#37474F]">Hide Company Name Text (Use if logo has name)</label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#78909C] uppercase">Header BG Color</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="color" 
                    value={form.headerBgColor} 
                    onChange={(e) => setForm({ ...form, headerBgColor: e.target.value })}
                    className="w-10 h-10 p-0 border-0 rounded cursor-pointer"
                  />
                  <span className="text-xs font-mono uppercase">{form.headerBgColor}</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#78909C] uppercase">Header Text Color</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="color" 
                    value={form.headerTextColor} 
                    onChange={(e) => setForm({ ...form, headerTextColor: e.target.value })}
                    className="w-10 h-10 p-0 border-0 rounded cursor-pointer"
                  />
                  <span className="text-xs font-mono uppercase">{form.headerTextColor}</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#78909C] uppercase">Footer BG Color</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="color" 
                    value={form.footerBgColor} 
                    onChange={(e) => setForm({ ...form, footerBgColor: e.target.value })}
                    className="w-10 h-10 p-0 border-0 rounded cursor-pointer"
                  />
                  <span className="text-xs font-mono uppercase">{form.footerBgColor}</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#78909C] uppercase">Footer Text Color</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="color" 
                    value={form.footerTextColor} 
                    onChange={(e) => setForm({ ...form, footerTextColor: e.target.value })}
                    className="w-10 h-10 p-0 border-0 rounded cursor-pointer"
                  />
                  <span className="text-xs font-mono uppercase">{form.footerTextColor}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#78909C] uppercase">Font Style</label>
              <select 
                value={form.fontStyle}
                onChange={(e) => setForm({ ...form, fontStyle: e.target.value as any })}
                className="w-full p-2 border border-[#B0BEC5] rounded bg-[#F5F9FD] text-sm"
              >
                <option value="helvetica">Helvetica (Standard)</option>
                <option value="times">Times New Roman</option>
                <option value="courier">Courier</option>
                <option value="courier">Optima</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-[#B0BEC5] flex justify-end">
          <button 
            onClick={() => {
              onSave(form);
              alert('PDF Settings saved successfully!');
              onBack();
            }}
            className="px-6 py-2.5 bg-[#0D47A1] text-white rounded-lg font-bold hover:bg-[#1565C0] transition-all flex items-center gap-2 shadow-lg"
          >
            <CheckCircle2 className="w-5 h-5" />
            Save Customizations
          </button>
        </div>
      </div>

      <div className="bg-slate-100 p-4 rounded-xl border-2 border-dashed border-slate-300">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center mb-4">Live Preview (Header & Footer)</p>
        
        <div className="bg-white shadow-lg max-w-md mx-auto overflow-hidden border border-slate-200">
          <div 
            style={{ backgroundColor: form.headerBgColor, color: form.headerTextColor }}
            className={`p-4 text-center border-b ${form.hideNameText && form.logo ? 'flex items-center justify-center' : ''}`}
          >
            {form.logo && <img src={form.logo} alt="Logo" className={`h-12 mx-auto ${!form.hideNameText ? 'mb-2' : ''}`} />}
            {!form.hideNameText && (
              <h4 className="font-bold text-lg uppercase" style={{ fontFamily: form.fontStyle }}>{form.companyName}</h4>
            )}
          </div>
          
          <div className="p-8 space-y-4">
            <div className="h-4 bg-slate-100 rounded w-3/4" />
            <div className="h-20 bg-slate-50 rounded w-full" />
            <div className="h-4 bg-slate-100 rounded w-1/2" />
          </div>

          <div 
            style={{ backgroundColor: form.footerBgColor, color: form.footerTextColor }}
            className="p-3 text-center text-[8px] space-y-1"
          >
            <p style={{ fontFamily: form.fontStyle }}>{form.address} | Email: {form.email}</p>
            <p style={{ fontFamily: form.fontStyle }}>Contact: {form.contact}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BillView({ type, nextNumber, onSave, onBack, initialBill, pdfSettings }: { type: 'BILL' | 'QUOTATION', nextNumber: number, onSave: (bill: Bill) => void, onBack: () => void, initialBill?: Bill, pdfSettings: PDFSettings }) {
  const [preparedBy, setPreparedBy] = useState(initialBill?.preparedBy || 'Bijoy Mahmud');
  const [date, setDate] = useState(initialBill?.date || new Date().toISOString().split('T')[0]);

  const getRefNumber = (preparedByName: string, dtStr: string, seqNum: number) => {
    const d = new Date(dtStr);
    const year = !isNaN(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
    const month = !isNaN(d.getTime()) ? (d.getMonth() + 1).toString().padStart(2, '0') : (new Date().getMonth() + 1).toString().padStart(2, '0');
    const clean = preparedByName.replace(/[^A-Za-z]/g, '');
    const initials = clean.substring(0, 2).toUpperCase() || 'BD';
    const seqStr = seqNum.toString().padStart(2, '0');
    return `BD-${initials}-${seqStr}/${year}/${month}`;
  };

  const billNumber = initialBill ? initialBill.billNumber : getRefNumber(preparedBy, date, nextNumber);
  const [recipientName, setRecipientName] = useState(initialBill?.recipientName || '');
  const [site, setSite] = useState(initialBill?.site || '');
  const [subject, setSubject] = useState(initialBill?.subject || (type === 'BILL' ? 'Bill for' : 'Quotation for'));
  const [items, setItems] = useState<BillItem[]>(initialBill?.items || [
    { id: crypto.randomUUID(), areaName: '', tiles: '', qty: 0, unit: 'sft', price: 0, total: 0 }
  ]);
  const [signature, setSignature] = useState<string | undefined>(initialBill?.signature || localStorage.getItem('savedSignature') || undefined);
  const [terms, setTerms] = useState(initialBill?.termsAndConditions || (type === 'QUOTATION' ? '1. Payment should be made within 7 days.\n2. 50% advance required.' : ''));

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setSignature(base64);
        localStorage.setItem('savedSignature', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), areaName: '', tiles: '', qty: 0, unit: 'sft', price: 0, total: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof BillItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'qty' || field === 'price') {
          updatedItem.total = (updatedItem.qty || 0) * (updatedItem.price || 0);
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const grandTotal = items.reduce((sum, item) => sum + item.total, 0);

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!recipientName.trim()) {
      alert('Please enter recipient name');
      return;
    }

    let revision = initialBill?.revision || 0;
    if (initialBill && initialBill.grandTotal !== grandTotal) {
      revision += 1;
    }

    const newBill: Bill = {
      id: initialBill ? initialBill.id : crypto.randomUUID(),
      type,
      billNumber,
      date,
      recipientName,
      site,
      subject,
      items,
      totalInWords: numberToWords(grandTotal),
      grandTotal,
      preparedBy,
      signature: signature || null,
      termsAndConditions: terms || null,
      timestamp: initialBill ? initialBill.timestamp : new Date().toLocaleString('en-GB'),
      revision
    };
    
    try {
      setIsSaving(true);
      await generateBillPDF(newBill, 'download', pdfSettings);
      await onSave(newBill);
    } catch (error: any) {
      console.error("Error in save sequence:", error);
      alert('Error occurred: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1 hover:bg-[#F5F5F5] rounded-full transition-colors cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold border-b-2 border-[#0D47A1] inline-block pb-1">
          {initialBill ? 'Edit' : 'Create'} {type === 'BILL' ? 'Bill' : 'Quotation'}
        </h2>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-md border border-[#B0BEC5] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#78909C] uppercase">Ref</label>
            <div className="w-full p-2 border border-[#B0BEC5] rounded bg-gray-100 text-sm font-bold text-[#0D47A1]">
              {billNumber}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#78909C] uppercase">Prepared By (Signature Person)</label>
            <input 
              type="text" 
              value={preparedBy} 
              onChange={(e) => setPreparedBy(e.target.value)}
              className="w-full p-2 border border-[#B0BEC5] rounded bg-[#F5F9FD] text-sm"
              placeholder="Signature Person Name"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#78909C] uppercase">Recipient Name</label>
            <input 
              type="text" 
              value={recipientName} 
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full p-2 border border-[#B0BEC5] rounded bg-[#F5F9FD] text-sm"
              placeholder="Recipient Name"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#78909C] uppercase">Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-2 border border-[#B0BEC5] rounded bg-[#F5F9FD] text-sm"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold text-[#78909C] uppercase">Site Name</label>
            <input 
              type="text" 
              value={site} 
              onChange={(e) => setSite(e.target.value)}
              className="w-full p-2 border border-[#B0BEC5] rounded bg-[#F5F9FD] text-sm"
              placeholder="Site Name"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold text-[#78909C] uppercase">Subject</label>
            <input 
              type="text" 
              value={subject} 
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-2 border border-[#B0BEC5] rounded bg-[#F5F9FD] text-sm"
            />
          </div>
          
          {type === 'QUOTATION' && (
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-bold text-[#78909C] uppercase">Terms & Conditions</label>
              <textarea 
                value={terms} 
                onChange={(e) => setTerms(e.target.value)}
                className="w-full p-2 border border-[#B0BEC5] rounded bg-[#F5F9FD] text-sm h-20"
                placeholder="Enter terms and conditions..."
              />
            </div>
          )}

          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold text-[#78909C] uppercase">Signature (Upload Image)</label>
            <div className="flex items-center gap-4">
              <input 
                type="file" 
                accept="image/*"
                onChange={handleSignatureUpload}
                className="text-xs cursor-pointer"
              />
              {signature && (
                <img src={signature} alt="Signature" className="h-10 border border-[#B0BEC5] rounded" />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-[#78909C] uppercase">Items</label>
            <button onClick={addItem} className="text-xs font-bold text-[#0D47A1] flex items-center gap-1 hover:underline">
              <Plus className="w-3 h-3" /> Add Item
            </button>
          </div>
          
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.id} className="p-3 border border-[#B0BEC5]/30 rounded-lg bg-[#F5F9FD] space-y-2 relative pr-10">
                <button 
                  onClick={() => removeItem(item.id)}
                  className="absolute right-2 top-2 text-red-500 hover:bg-red-50 p-1 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <input 
                      type="text" 
                      placeholder="Area Name"
                      value={item.areaName}
                      onChange={(e) => updateItem(item.id, 'areaName', e.target.value)}
                      className="w-full p-1.5 border border-[#B0BEC5] rounded text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="text" 
                      placeholder="Work Description"
                      value={item.tiles}
                      onChange={(e) => updateItem(item.id, 'tiles', e.target.value)}
                      className="w-full p-1.5 border border-[#B0BEC5] rounded text-xs"
                    />
                  </div>
                  <div>
                    <input 
                      type="number" 
                      placeholder="Qty"
                      value={item.qty || ''}
                      onChange={(e) => updateItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
                      className="w-full p-1.5 border border-[#B0BEC5] rounded text-xs"
                    />
                  </div>
                  <div>
                    <input 
                      type="text" 
                      placeholder="Unit (sft/rft)"
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                      className="w-full p-1.5 border border-[#B0BEC5] rounded text-xs"
                    />
                  </div>
                  <div>
                    <input 
                      type="number" 
                      placeholder="Price"
                      value={item.price || ''}
                      onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                      className="w-full p-1.5 border border-[#B0BEC5] rounded text-xs"
                    />
                  </div>
                  <div className="flex items-center justify-end font-bold text-xs">
                    Total: {item.total.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-[#B0BEC5] flex justify-between items-center gap-2">
          <div className="px-3 py-2 bg-[#E8F5E9] text-[#2E7D32] rounded-lg font-bold text-xs sm:text-sm">
            Grand Total: Tk. {grandTotal.toLocaleString()}
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-2 bg-[#0D47A1] text-white rounded-lg font-bold hover:bg-[#1565C0] transition-all text-[10px] sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {initialBill ? 'Update' : 'Submit'} {type === 'BILL' ? 'Bill' : 'Quotation'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BillingManager({ user, currentUserDoc, isApproved }: { user: any, currentUserDoc: any, isApproved: boolean }) {
  const [view, setView] = useState<'main' | 'settings' | 'create_bill' | 'create_quote'>('main');
  const [pdfSettings, setPdfSettings] = useState<PDFSettings>(DEFAULT_PDF_SETTINGS);
  const [nextNumber, setNextNumber] = useState(1);

  const isSupremeAdmin = ['bijoymahmudmunna@gmail.com'].includes(user?.email || '') || currentUserDoc?.role === 'supreme_admin';
  const isSuperAdmin = isSupremeAdmin || currentUserDoc?.role === 'super_admin';
  const isAdmin = isSuperAdmin || currentUserDoc?.role === 'admin';

  React.useEffect(() => {
    const saved = localStorage.getItem('pdfSettings');
    if (saved) {
      try {
        setPdfSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved pdfSettings', e);
      }
    }

    if (!user || !isApproved) return;

    const fetchNextNumber = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'billing_records'));
        setNextNumber(querySnapshot.size + 1);
      } catch (e: any) {
        console.log("Permissions check warning for Billing:", e);
        try {
          handleFirestoreError(e, OperationType.LIST, 'billing_records');
        } catch (handleError) {
          console.warn("Handled firestore list permission error:", handleError);
        }
      }
    };
    fetchNextNumber();
  }, [user, isApproved]);

  const handleSaveSettings = (s: PDFSettings) => {
    setPdfSettings(s);
    localStorage.setItem('pdfSettings', JSON.stringify(s));
  };

  const handleBillSave = async (b: Bill) => {
    try {
      if (!isApproved) {
        toast.error('You do not have permission to save to the database.');
        return;
      }
      await setDoc(doc(db, 'billing_records', b.id), b);
      toast.success('Successfully saved to database!');
      setNextNumber(n => n + 1);
      setView('main');
    } catch (err: any) {
      console.warn("Firebase save error:", err);
      toast.error('Failed to save to database: ' + err.message);
      try {
        handleFirestoreError(err, OperationType.WRITE, `billing_records/${b.id}`);
      } catch (handleError) {
        console.warn("Handled write error:", handleError);
      }
      // Even if cloud save fails, we can return to main if the PDF downloaded
      setNextNumber(n => n + 1);
      setView('main');
    }
  };

  if (view === 'settings') {
    if (!isAdmin) {
      return (
        <div className="p-6 bg-red-50 text-red-700 font-bold rounded-xl border border-red-200">
          You do not have permission to customize PDF settings.
        </div>
      );
    }
    return <PDFSettingsView settings={pdfSettings} onSave={handleSaveSettings} onBack={() => setView('main')} />;
  }

  if (view === 'create_bill') {
    if (!isAdmin) {
      return (
        <div className="p-6 bg-red-50 text-red-700 font-bold rounded-xl border border-red-200">
          You do not have permission to create bills. Only Quotation is allowed.
        </div>
      );
    }
    return <BillView type="BILL" nextNumber={nextNumber} pdfSettings={pdfSettings} onSave={handleBillSave} onBack={() => setView('main')} />;
  }

  if (view === 'create_quote') {
    return <BillView type="QUOTATION" nextNumber={nextNumber} pdfSettings={pdfSettings} onSave={handleBillSave} onBack={() => setView('main')} />;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold border-b pb-2 flex items-center justify-between">
        Billing & Quotation
        {isAdmin && (
          <button onClick={() => setView('settings')} className="text-sm px-3 py-1.5 font-medium rounded bg-gray-100 hover:bg-gray-200 transition-colors flex items-center gap-2">
            <Settings className="w-4 h-4" /> PDF Settings
          </button>
        )}
      </h2>

      <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-2' : ''} gap-4`}>
        {isAdmin && (
          <div 
            onClick={() => setView('create_bill')}
            className="bg-white border hover:border-blue-500 rounded-xl p-6 cursor-pointer hover:shadow-md transition-all flex flex-col items-center justify-center gap-4 py-12"
          >
            <div className="bg-blue-100 p-4 rounded-full text-blue-600">
              <FileText className="w-8 h-8" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg">Create Bill</h3>
              <p className="text-gray-500 text-sm">Generate a new bill for installation work</p>
            </div>
          </div>
        )}

        <div 
          onClick={() => setView('create_quote')}
          className="bg-white border hover:border-purple-500 rounded-xl p-6 cursor-pointer hover:shadow-md transition-all flex flex-col items-center justify-center gap-4 py-12"
        >
          <div className="bg-purple-100 p-4 rounded-full text-purple-600">
            <FileText className="w-8 h-8" />
          </div>
          <div className="text-center">
            <h3 className="font-bold text-lg">Create Quotation</h3>
            <p className="text-gray-500 text-sm">Generate a new quotation document</p>
          </div>
        </div>
      </div>
    </div>
  );
}
