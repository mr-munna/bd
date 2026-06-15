import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  FileText, 
  Download, 
  Printer, 
  Plus, 
  Trash2, 
  Search, 
  Check, 
  Edit, 
  Loader2,
  X,
  Package
} from 'lucide-react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, addDoc, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { Tile, Good, Tool, Sale, SaleItem, UserDoc } from './types';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { toast } from 'react-hot-toast';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  let nStr = num.toString();
  if (nStr.length > 9) return 'OVERFLOW';
  const n = ('000000000' + nStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return ''; 
  let str = '';
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
  str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  
  const result = (str.trim() + ' taka only').toLowerCase();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export function SalesManager({ 
  user,
  isAdmin,
  tiles,
  goods,
  tools,
  bookedItems,
  quoteHeader,
  quoteFooter
}: { 
  user: any;
  isAdmin: boolean;
  tiles: Tile[];
  goods: Good[];
  tools: Tool[];
  bookedItems: any[];
  quoteHeader: any;
  quoteFooter: any;
}) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);

  const [itemSearchQuery, setItemSearchQuery] = useState('');
  
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'sales'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setSales(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
      setIsLoading(false);
    });
    return unsub;
  }, []);

  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const seq = (sales.length + 1).toString().padStart(4, '0');
    return `INV-${year}${month}-${seq}`;
  };

  const handleAddItem = (item: any, type: 'tile' | 'good' | 'tool') => {
    const newItem: SaleItem = {
      id: Math.random().toString(36).substring(7),
      type,
      name: type === 'good' ? `${item.brand} - ${item.description}` : 
            type === 'tile' ? `${item.name} (${item.size})` :
            item.details,
      quantity: 1,
      unit: type === 'tile' ? 'sft' : 'pcs',
      unitPrice: 0,
      total: 0
    };
    setSaleItems([...saleItems, newItem]);
    setItemSearchQuery('');
  };

  const updateItem = (id: string, field: keyof SaleItem, value: number) => {
    setSaleItems(items => items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        updated.total = updated.quantity * updated.unitPrice;
        return updated;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setSaleItems(items => items.filter(item => item.id !== id));
  };

  const calculateSubtotal = () => {
    return saleItems.reduce((sum, item) => sum + item.total, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal - (discount || 0);
  };

  const handleDiscountPercentChange = (p: number) => {
    const subtotal = calculateSubtotal();
    setDiscountPercent(p);
    const amount = (subtotal * p) / 100;
    setDiscount(Number(amount.toFixed(2)));
  };

  const handleDiscountAmountChange = (a: number) => {
    const subtotal = calculateSubtotal();
    setDiscount(a);
    if (subtotal > 0) {
      const p = (a / subtotal) * 100;
      setDiscountPercent(Number(p.toFixed(2)));
    } else {
      setDiscountPercent(0);
    }
  };

  const handleSaveSale = async () => {
    if (!clientName || saleItems.length === 0) return;
    setIsSaving(true);
    
    try {
      const totalAmount = calculateTotal();
      const newSale: Omit<Sale, 'id'> = {
        invoiceNumber: generateInvoiceNumber(),
        date: new Date().toISOString(),
        clientName,
        clientPhone,
        clientAddress,
        items: saleItems,
        subTotal: calculateSubtotal(),
        discount,
        discountPercent,
        totalAmount,
        paidAmount,
        dueAmount: totalAmount - paidAmount,
        status: paidAmount >= totalAmount ? 'paid' : (paidAmount > 0 ? 'partial' : 'due'),
        createdBy: user.uid
      };

      const docRef = await addDoc(collection(db, 'sales'), newSale);
      
      // Batch update inventory quantities (simplified for default location)
      const batch = writeBatch(db);
      
      saleItems.forEach(saleItem => {
         // Tile deduction
         const tileMatch = tiles.find(t => `${t.name} (${t.size})` === saleItem.name);
         if (tileMatch) {
            const tileRef = doc(db, 'tiles', tileMatch.id);
            let deductSft = 0;
            let deductPcs = 0;

            const sizeStr = tileMatch.size ? String(tileMatch.size).toLowerCase() : '';
            let unitSft = 0;
            if (sizeStr.includes('x')) {
                const parts = sizeStr.split('x');
                const w = parseFloat(parts[0]);
                const h = parseFloat(parts[1]);
                if (!isNaN(w) && !isNaN(h)) {
                    unitSft = (w / 30) * (h / 30);
                }
            }

            if (saleItem.unit === 'sft') {
                deductSft = saleItem.quantity;
                deductPcs = unitSft > 0 ? Math.round(deductSft / unitSft) : 0;
            } else if (saleItem.unit === 'pcs') {
                deductPcs = saleItem.quantity;
                deductSft = unitSft > 0 ? Number((deductPcs * unitSft).toFixed(2)) : 0;
            }

            // Cascading deduction logic for Tiles
            let remSft = deductSft;
            let remPcs = deductPcs;

            let diaBariSft = tileMatch.diaBariSft || 0;
            let diaBariPcs = tileMatch.diaBariPcs || 0;
            if (diaBariSft >= remSft) { diaBariSft -= remSft; remSft = 0; } else { remSft -= diaBariSft; diaBariSft = 0; }
            if (diaBariPcs >= remPcs) { diaBariPcs -= remPcs; remPcs = 0; } else { remPcs -= diaBariPcs; diaBariPcs = 0; }

            let bonorupaSft = tileMatch.bonorupaSft || 0;
            let bonorupaPcs = tileMatch.bonorupaPcs || 0;
            if (bonorupaSft >= remSft) { bonorupaSft -= remSft; remSft = 0; } else { remSft -= bonorupaSft; bonorupaSft = 0; }
            if (bonorupaPcs >= remPcs) { bonorupaPcs -= remPcs; remPcs = 0; } else { remPcs -= bonorupaPcs; bonorupaPcs = 0; }

            let bananiSft = tileMatch.bananiSft || 0;
            let bananiPcs = tileMatch.bananiPcs || 0;
            if (bananiSft >= remSft) { bananiSft -= remSft; remSft = 0; } else { remSft -= bananiSft; bananiSft = 0; }
            if (bananiPcs >= remPcs) { bananiPcs -= remPcs; remPcs = 0; } else { remPcs -= bananiPcs; bananiPcs = 0; }

            // If there's still remainder, just force negative on diaBari (default)
            if (remSft > 0) diaBariSft -= remSft;
            if (remPcs > 0) diaBariPcs -= remPcs;

            const newTotalSft = Number((diaBariSft + bonorupaSft + bananiSft).toFixed(2));
            const newTotalPcs = diaBariPcs + bonorupaPcs + bananiPcs;

            batch.update(tileRef, { 
                diaBariSft: Number(diaBariSft.toFixed(2)), 
                diaBariPcs: Math.round(diaBariPcs),
                bonorupaSft: Number(bonorupaSft.toFixed(2)),
                bonorupaPcs: Math.round(bonorupaPcs),
                bananiSft: Number(bananiSft.toFixed(2)),
                bananiPcs: Math.round(bananiPcs),
                totalSft: newTotalSft,
                totalPcs: newTotalPcs
            });

            // Deduct from bookedItems for this client
            const matchingBookedTile = bookedItems.find(b => !b.deleted && b.name === tileMatch.name && b.clientName.toLowerCase() === clientName.toLowerCase().trim());
            if (matchingBookedTile) {
                const bookRef = doc(db, 'bookedItems', matchingBookedTile.id);
                const newBookedSft = Math.max(0, (matchingBookedTile.qtySft || 0) - deductSft);
                const newBookedPcs = Math.max(0, (matchingBookedTile.qtyPcs || 0) - deductPcs);
                batch.update(bookRef, { qtySft: newBookedSft, qtyPcs: newBookedPcs });
            }
         }
         
         // Goods deduction
         const goodMatch = goods.find(g => `${g.brand} - ${g.description}` === saleItem.name);
         if (goodMatch) {
             const goodRef = doc(db, 'goods', goodMatch.id);
             
             let remQty = saleItem.quantity;
             let dokhinkhan = goodMatch.dokhinkhan || 0;
             if (dokhinkhan >= remQty) { dokhinkhan -= remQty; remQty = 0; } else { remQty -= dokhinkhan; dokhinkhan = 0; }
             
             let bonorupa = goodMatch.bonorupa || 0;
             if (bonorupa >= remQty) { bonorupa -= remQty; remQty = 0; } else { remQty -= bonorupa; bonorupa = 0; }
             
             let banani = goodMatch.banani || 0;
             if (banani >= remQty) { banani -= remQty; remQty = 0; } else { remQty -= banani; banani = 0; }
             
             // If there's still remainder, just force negative on dokhinkhan (default)
             if (remQty > 0) dokhinkhan -= remQty;

             batch.update(goodRef, { 
                 dokhinkhan: dokhinkhan,
                 bonorupa: bonorupa,
                 banani: banani
             });

             const matchingBookedGood = bookedItems.find(b => !b.deleted && b.brand === goodMatch.brand && b.clientName.toLowerCase() === clientName.toLowerCase().trim() && (b.name === goodMatch.description || b.name === goodMatch.code || b.code === goodMatch.code));
             if (matchingBookedGood) {
                 const bookRef = doc(db, 'bookedItems', matchingBookedGood.id);
                 const newBookedPcs = Math.max(0, (matchingBookedGood.qtyPcs || 0) - saleItem.quantity);
                 batch.update(bookRef, { qtyPcs: newBookedPcs });
             }
         }

         // Tools deduction
         const toolMatch = tools.find(t => t.details === saleItem.name);
         if (toolMatch) {
             const toolRef = doc(db, 'tools', toolMatch.id);
             batch.update(toolRef, { qty: Math.max(0, (toolMatch.qty || 0) - saleItem.quantity) });
         }
      });
      await batch.commit();

      setShowNewSaleModal(false);
      // Reset form
      setClientName('');
      setClientPhone('');
      setClientAddress('');
      setSaleItems([]);
      setDiscount(0);
      setPaidAmount(0);
      
      // Open the new sale
      setSelectedSale({ id: docRef.id, ...newSale });
      toast.success("Sale completed successfully", { icon: "🔥" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error saving sale");
      console.error("Error saving sale:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredInventory = useMemo(() => {
    if (!itemSearchQuery) return [];
    
    const query = itemSearchQuery.toLowerCase();
    
    const matchedTiles = tiles
      .filter(t => !t.deleted && (t.name.toLowerCase().includes(query) || t.size.toLowerCase().includes(query)))
      .map(t => ({ ...t, type: 'tile' as const }));
      
    const matchedGoods = goods
      .filter(g => !g.deleted && (g.description.toLowerCase().includes(query) || g.brand.toLowerCase().includes(query) || g.code.toLowerCase().includes(query)))
      .map(g => ({ ...g, type: 'good' as const }));
      
    return [...matchedTiles, ...matchedGoods].slice(0, 10);
  }, [itemSearchQuery, tiles, goods]);

  const handleDeleteSale = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const executeDeleteSale = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteDoc(doc(db, 'sales', confirmDeleteId));
      setConfirmDeleteId(null);
      toast.success("Sale deleted successfully");
    } catch (error) {
      console.error("Error deleting sale:", error);
      toast.error("Failed to delete sale. Please check your permissions.");
      setConfirmDeleteId(null);
    }
  };

  const handleActualPrint = () => {
    toast.loading("Preparing print...", { duration: 1000 });
    window.focus();
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handlePrint = async () => {
    if (!selectedSale) return;
    
    const invoiceEl = document.getElementById(`invoice-${selectedSale.id}`);
    if (!invoiceEl) return;

    try {
      const originalStyle = invoiceEl.style.display;
      invoiceEl.style.display = 'block';
      
      const originalSrcs = new Map<HTMLImageElement, string>();
      const images = Array.from(invoiceEl.querySelectorAll('img')) as HTMLImageElement[];
      
      await Promise.all(images.map(async (img) => {
        if (img.src && !img.src.startsWith('data:')) {
          originalSrcs.set(img, img.src);
          try {
             const url = img.src;
             let fetchAsBase64 = async (fetchUrl: string) => {
                const response = await fetch(fetchUrl);
                if (!response.ok) throw new Error('Network response was not ok');
                const blob = await response.blob();
                if (!blob.type.startsWith('image/')) {
                  throw new Error(`Invalid content type: ${blob.type}`);
                }
                return await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
             };
             
             try {
                img.src = await fetchAsBase64(url);
             } catch (fetchErr) {
               try {
                 const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
                 img.src = await fetchAsBase64(proxyUrl);
               } catch (localProxyErr) {
                 try {
                   const externalProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                   img.src = await fetchAsBase64(externalProxyUrl);
                 } catch (fallbackErr) {
                   console.error("All image proxies failed for PDF.");
                   img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                 }
               }
             }
          } catch (e) {
            console.warn("Failed to convert image to base64 for PDF", e);
          }
        }
      }));

      const canvas = await html2canvas(invoiceEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (clonedDoc: Document) => {
            const allElements = clonedDoc.querySelectorAll('*');
            allElements.forEach(el => {
              const htmlEl = el as HTMLElement;
              // Detect and replace okl colors which crash html2canvas
              const styles = window.getComputedStyle(el);
              if (styles.color && styles.color.includes('okl')) {
                  htmlEl.style.color = '#1f2937';
              }
              if (styles.backgroundColor && styles.backgroundColor.includes('okl')) {
                  htmlEl.style.backgroundColor = '#f3f4f6';
              }
              if (styles.borderColor && styles.borderColor.includes('okl')) {
                htmlEl.style.borderColor = '#e5e7eb';
              }
              // Specific fixes for common tailwind classes
              if (htmlEl.classList.contains('text-blue-600')) htmlEl.style.color = '#2563eb';
              if (htmlEl.classList.contains('text-blue-500')) htmlEl.style.color = '#3b82f6';
              if (htmlEl.classList.contains('text-gray-900')) htmlEl.style.color = '#111827';
              if (htmlEl.classList.contains('text-gray-600')) htmlEl.style.color = '#4b5563';
              if (htmlEl.classList.contains('text-gray-500')) htmlEl.style.color = '#6b7280';
              if (htmlEl.classList.contains('bg-blue-50')) htmlEl.style.backgroundColor = '#eff6ff';
              if (htmlEl.classList.contains('bg-gray-50')) htmlEl.style.backgroundColor = '#f9fafb';
              if (htmlEl.classList.contains('border-gray-100')) htmlEl.style.borderColor = '#f3f4f6';
              if (htmlEl.classList.contains('border-gray-200')) htmlEl.style.borderColor = '#e5e7eb';
            });

            // Also clean up style tags like in App.tsx
            const styleTags = clonedDoc.querySelectorAll('style');
            styleTags.forEach(tag => {
              tag.innerHTML = tag.innerHTML.replace(/[^;{}]*okl(ch|ab)[^;{}]*;/g, '');
              tag.innerHTML = tag.innerHTML.replace(/[^;{}]*okl(ch|ab)[^;{}]*}/g, '}');
              tag.innerHTML = tag.innerHTML.replace(/okl(ch|ab)\([^)]+\)/g, 'rgb(0,0,0)');
              tag.innerHTML = tag.innerHTML.replace(/okl(ch|ab)/g, 'rgb');
            });
          }
      });
      
      // Restore original image sources
      originalSrcs.forEach((originalUrl, img) => {
        img.src = originalUrl;
      });
      
      invoiceEl.style.display = originalStyle;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice_${selectedSale.invoiceNumber}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF. Check if image URLs are valid.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Custom Confirmation Modal for Deletion */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDeleteId(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2 font-sans">Delete Sale</h3>
              <p className="text-gray-600 mb-6 text-sm">Are you sure you want to delete this sale record? This action cannot be undone and will not revert stock levels.</p>
              <div className="flex gap-3">
                <button 
                  className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition-colors text-sm"
                  onClick={() => setConfirmDeleteId(null)}
                >
                  Cancel
                </button>
                <button 
                  className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-colors text-sm"
                  onClick={executeDeleteSale}
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-[#0f172a]" />
          Sales & Invoices
        </h2>
        {isAdmin && (
          <button
            onClick={() => setShowNewSaleModal(true)}
            className="bg-[#0f172a] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Sale
          </button>
        )}
      </div>

      {/* Sales List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
         ) : sales.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No sales recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-normal">Invoice</th>
                  <th className="px-6 py-4 font-normal">Date</th>
                  <th className="px-6 py-4 font-normal">Client</th>
                  <th className="px-6 py-4 font-normal text-right">Amount</th>
                  <th className="px-6 py-4 font-normal text-center">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-blue-600">{sale.invoiceNumber}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(sale.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-gray-900 font-medium">{sale.clientName}</td>
                    <td className="px-6 py-4 text-right font-normal tracking-tight">
                      Tk. {sale.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        sale.status === 'paid' ? "bg-green-100 text-green-700" :
                        sale.status === 'partial' ? "bg-orange-100 text-orange-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        {sale.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setSelectedSale(sale)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs bg-blue-50 px-3 py-1.5 rounded-lg"
                      >
                        View
                      </button>
                      {isAdmin && (
                        <button 
                          onClick={(e) => handleDeleteSale(sale.id, e)}
                          className="text-red-600 hover:text-red-800 font-medium text-xs bg-red-50 px-3 py-1.5 rounded-lg ml-2"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm mt-10 print-container">
             <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50 no-print">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500"/> Invoice {selectedSale.invoiceNumber}
                    </h3>
                    <div className="flex items-center gap-2">
                        <button onClick={handleActualPrint} className="flex items-center gap-1 p-2 px-3 text-gray-600 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-gray-200 transition-all cursor-pointer" title="Print Invoice">
                            <Printer className="w-4 h-4" />
                            <span className="text-xs font-bold">Print</span>
                        </button>
                        <button onClick={handlePrint} className="flex items-center gap-1 p-2 px-3 text-gray-600 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-gray-200 transition-all cursor-pointer" title="Download PDF">
                            <Download className="w-4 h-4" />
                            <span className="text-xs font-bold">PDF</span>
                        </button>
                        <button onClick={() => setSelectedSale(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-8 overflow-y-auto bg-gray-100 flex-1 flex justify-center">
                  <div 
                    id={`invoice-${selectedSale.id}`} 
                    className="bg-white shadow-xl border border-gray-200 overflow-hidden flex flex-col w-full max-w-[210mm] min-h-[297mm] relative" 
                  >
                   {/* Header */}
                   <div id="quotation-header" className="bg-black relative group overflow-hidden w-full">
                   {quoteHeader?.headerImage ? (
                     <img 
                       src={quoteHeader.headerImage} 
                       alt="Header" 
                       className="w-full h-auto block min-h-[100px]" 
                       referrerPolicy="no-referrer" 
                       crossOrigin="anonymous"
                       onError={(e) => {
                         (e.target as HTMLImageElement).style.display = 'none';
                       }}
                     />
                   ) : (
                     <div className="p-6 flex items-center gap-4 min-h-[120px]">
                       <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center overflow-hidden">
                         <span className="text-black font-black text-2xl">{quoteHeader?.logoText || 'LOGO'}</span>
                       </div>
                       <div>
                         <h1 className="text-2xl font-black tracking-widest uppercase">{quoteHeader?.companyName || 'COMPANY NAME'}</h1>
                       </div>
                     </div>
                   )}
                   </div>

                       <div className="p-8 pb-32 flex-1">
                           <div className="text-center mb-8 border-b-2 border-gray-900 pb-4">
                                <h1 className="text-4xl font-black tracking-widest text-gray-900 uppercase">INVOICE</h1>
                                <p className="text-gray-500 font-mono mt-1">{selectedSale.invoiceNumber}</p>
                           </div>

                           <div className="flex justify-between mb-12">
                               <div>
                                   <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Billed To</div>
                                   <h2 className="text-xl font-bold text-gray-900">{selectedSale.clientName}</h2>
                                   {selectedSale.clientAddress && <p className="text-sm text-gray-600 mt-1 max-w-[250px]">{selectedSale.clientAddress}</p>}
                                   {selectedSale.clientPhone && <p className="text-sm text-gray-600 mt-1 font-mono">{selectedSale.clientPhone}</p>}
                               </div>
                               <div className="text-right">
                                   <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Date Issue</div>
                                   <p className="text-gray-900 font-medium">
                                       {new Date(selectedSale.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                   </p>
                                   <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 mt-4">Invoice Total</div>
                                   <p className="text-gray-900 font-black text-xl">
                                       Tk. {selectedSale.totalAmount.toLocaleString()}
                                   </p>
                                   <p className={cn("text-xs font-bold mt-1 uppercase tracking-wider", 
                                        selectedSale.status === 'paid' ? "text-green-600" :
                                        selectedSale.status === 'partial' ? "text-orange-600" :
                                        "text-red-600"
                                   )}>
                                       {selectedSale.status}
                                   </p>
                               </div>
                           </div>

                           <table className="w-full mb-12">
                                <thead>
                                    <tr className="border-b-2 border-gray-900">
                                        <th className="py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider w-12">SL</th>
                                        <th className="py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">Description</th>
                                        <th className="py-3 text-center text-xs font-normal text-gray-500 uppercase tracking-wider w-20">Unit</th>
                                        <th className="py-3 text-right text-xs font-normal text-gray-500 uppercase tracking-wider w-24">Qty</th>
                                        <th className="py-3 text-right text-xs font-normal text-gray-500 uppercase tracking-wider w-32">Rate (Tk. )</th>
                                        <th className="py-3 text-right text-xs font-normal text-gray-500 uppercase tracking-wider w-32">Total (Tk. )</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedSale.items.map((item, index) => (
                                        <tr key={index} className="border-b border-gray-100">
                                            <td className="py-4 text-sm font-medium text-gray-900">{String(index + 1).padStart(2, '0')}</td>
                                            <td className="py-4 text-sm text-gray-800">{item.name}</td>
                                            <td className="py-4 text-sm text-gray-600 text-center uppercase">{item.unit}</td>
                                            <td className="py-4 text-sm text-gray-800 text-right font-mono">{item.quantity}</td>
                                            <td className="py-4 text-sm text-gray-800 text-right font-mono">{item.unitPrice.toLocaleString()}</td>
                                            <td className="py-4 text-sm font-normal text-gray-900 text-right font-mono">{item.total.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                           </table>

                           <div className="flex justify-between items-start pt-4 border-t-2 border-gray-900">
                                <div className="max-w-xs space-y-4">
                                     <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">In Words</p>
                                        <p className="text-sm font-medium text-gray-800 italic capitalize">{numberToWords(selectedSale.totalAmount)}</p>
                                     </div>
                                     {selectedSale.paidAmount > 0 && (
                                         <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                             <div className="flex justify-between items-center text-sm">
                                                 <span className="text-gray-600 font-medium">Billed:</span>
                                                 <span className="font-mono text-gray-900">Tk. {selectedSale.totalAmount.toLocaleString()}</span>
                                             </div>
                                             <div className="flex justify-between items-center text-sm mt-1 border-b border-gray-200 pb-1">
                                                 <span className="text-green-600 font-medium">Paid:</span>
                                                 <span className="font-mono text-green-700">Tk. {selectedSale.paidAmount.toLocaleString()}</span>
                                             </div>
                                             <div className="flex justify-between items-center text-sm mt-1 pt-1 font-bold">
                                                 <span className="text-orange-600">Due:</span>
                                                 <span className="font-mono text-orange-700">Tk. {selectedSale.dueAmount.toLocaleString()}</span>
                                             </div>
                                         </div>
                                     )}
                                </div>
                               <div className="w-72 space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 font-medium">Subtotal:</span>
                                        <span className="font-mono text-gray-900">Tk. {selectedSale.subTotal.toLocaleString()}</span>
                                    </div>
                                    {selectedSale.discount > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-red-500 font-medium">Discount:</span>
                                            <span className="font-mono text-red-600">- Tk. {selectedSale.discount.toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center text-lg font-black border-t-2 border-gray-900 pt-3 mt-3">
                                        <span className="text-gray-900">Total:</span>
                                        <span className="tracking-tight text-blue-600">Tk. {selectedSale.totalAmount.toLocaleString()}</span>
                                    </div>
                               </div>
                           </div>
                       </div>
                       
                        {/* Footer */}
                        <div id="quotation-footer" className="absolute bottom-0 left-0 right-0">
                          {quoteFooter?.footerImage ? (
                            <img 
                              src={quoteFooter.footerImage} 
                              alt="Footer" 
                              className="w-full h-auto block min-h-[50px]" 
                              referrerPolicy="no-referrer"
                              crossOrigin="anonymous"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="bg-black p-4 text-center">
                              <p className="text-white/50 text-xs tracking-widest uppercase">{quoteFooter?.companyName || 'COMPANY NAME'}</p>
                            </div>
                          )}
                        </div>
                  </div>
                </div>
             </div>
          </div>
      )}

      {showNewSaleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm mt-10">
            <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Plus className="w-5 h-5 text-blue-500"/> New Sale
                    </h3>
                    <button onClick={() => setShowNewSaleModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 h-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div className="space-y-4">
                            <h4 className="font-bold text-sm text-gray-500 uppercase tracking-wider">Client Information</h4>
                            <div className="space-y-3">
                                <input
                                    placeholder="Client Name *"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                                <input
                                    placeholder="Phone Number"
                                    value={clientPhone}
                                    onChange={(e) => setClientPhone(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                                <textarea
                                    placeholder="Address"
                                    value={clientAddress}
                                    onChange={(e) => setClientAddress(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm h-24 resize-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                             <h4 className="font-bold text-sm text-gray-500 uppercase tracking-wider">Payment Details</h4>
                             <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Paid Amount (Tk. )</label>
                                            <div className="flex gap-1">
                                                <button 
                                                    onClick={() => setPaidAmount(calculateTotal())}
                                                    className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold hover:bg-green-200 transition-colors shadow-sm"
                                                >
                                                    PAID
                                                </button>
                                                <button 
                                                    onClick={() => setPaidAmount(0)}
                                                    className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold hover:bg-red-200 transition-colors shadow-sm"
                                                >
                                                    DUE
                                                </button>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">Tk. </span>
                                            <input
                                                type="number"
                                                value={paidAmount || ''}
                                                onChange={(e) => setPaidAmount(Number(e.target.value))}
                                                className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-right font-mono text-lg text-green-700 focus:ring-2 focus:ring-green-500 outline-none shadow-sm"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Discount (%)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={discountPercent || ''}
                                                onChange={(e) => handleDiscountPercentChange(Number(e.target.value))}
                                                className="w-full pl-4 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-right font-mono text-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                                placeholder="0"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Discount (Tk. )</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">Tk. </span>
                                            <input
                                                type="number"
                                                value={discount || ''}
                                                onChange={(e) => handleDiscountAmountChange(Number(e.target.value))}
                                                className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-right font-mono text-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                {saleItems.length > 0 && (
                                    <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-xs font-bold text-gray-400">
                                        <span className="uppercase">Net Payable Amount:</span>
                                        <span className="text-sm font-black text-blue-600 font-mono">
                                            Tk. {calculateTotal().toLocaleString()}
                                        </span>
                                    </div>
                                )}
                             </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm text-gray-500 uppercase tracking-wider">Sale Items</h4>
                            <div className="relative w-72">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    placeholder="Search inventory to add..."
                                    value={itemSearchQuery}
                                    onChange={(e) => setItemSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                {itemSearchQuery && filteredInventory.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 shadow-xl rounded-xl max-h-60 overflow-y-auto z-50">
                                         {filteredInventory.map(item => (
                                             <button
                                                key={item.id}
                                                onClick={() => handleAddItem(item, item.type as any)}
                                                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-center justify-between group"
                                             >
                                                <span className="text-sm font-medium text-gray-900 line-clamp-1">
                                                    {item.type === 'tile' ? `${item.name} (${item.size})` :
                                                     item.type === 'good' ? `${item.brand} - ${item.description}` : item.name}
                                                </span>
                                                <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 rounded text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors uppercase">
                                                    Add
                                                </span>
                                             </button>
                                         ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {saleItems.length > 0 ? (
                            <div className="overflow-x-auto border border-gray-200 rounded-xl">
                                <table className="w-full text-sm text-left border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-3 font-normal text-gray-500 uppercase text-xs w-12">#</th>
                                        <th className="px-4 py-3 font-normal text-gray-500 uppercase text-xs">Item Description</th>
                                        <th className="px-4 py-3 font-normal text-gray-500 uppercase text-xs w-24">Unit</th>
                                        <th className="px-4 py-3 font-normal text-gray-500 uppercase text-xs w-32 text-right">Qty</th>
                                        <th className="px-4 py-3 font-normal text-gray-500 uppercase text-xs w-40 text-right">Unit Price (Tk. )</th>
                                        <th className="px-4 py-3 font-normal text-gray-500 uppercase text-xs w-40 text-right">Total (Tk. )</th>
                                        <th className="px-4 py-3 font-normal text-center w-16"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {saleItems.map((item, idx) => (
                                        <tr key={item.id} className="border-b border-x border-gray-200">
                                            <td className="px-4 py-3 font-medium text-gray-500 text-center">{idx + 1}</td>
                                            <td className="px-4 py-3 text-gray-900 font-medium">{item.name}</td>
                                            <td className="px-4 py-3">
                                                <select 
                                                    value={item.unit}
                                                    onChange={(e) => updateItem(item.id, 'unit', e.target.value as any)}
                                                    className="w-full bg-transparent border-0 text-sm font-medium uppercase outline-none focus:ring-0 p-0 text-gray-600 cursor-pointer"
                                                >
                                                    <option value="pcs">PCS</option>
                                                    <option value="sft">SFT</option>
                                                    <option value="bx">BX</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                                                    className="w-full text-right font-mono bg-blue-50/50 border border-blue-100 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    value={item.unitPrice}
                                                    onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                                                    className="w-full text-right font-mono bg-blue-50/50 border border-blue-100 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-normal text-gray-900">
                                                {item.total.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                                    <Trash2 className="w-4 h-4 mx-auto" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        ) : (
                            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3 bg-gray-50/50">
                                <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center border border-gray-100">
                                    <Package className="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900">No items added yet</p>
                                    <p className="text-xs text-gray-500 mt-1">Search inventory above to add items to this sale</p>
                                </div>
                            </div>
                        )}

                        {saleItems.length > 0 && (
                            <div className="flex justify-end pt-6">
                                <div className="w-80 space-y-3 bg-gray-50 p-6 rounded-2xl border border-gray-200">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 font-medium tracking-wide">Subtotal</span>
                                        <span className="font-mono text-gray-900 font-medium">Tk. {calculateSubtotal().toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-red-500 font-medium tracking-wide">Discount</span>
                                        <span className="font-mono text-red-600 font-medium">- Tk. {(calculateSubtotal() - calculateTotal()).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-lg font-black border-t-2 border-gray-900 pt-3 mt-3">
                                        <span className="text-gray-900 tracking-wide">Total</span>
                                        <span className="tracking-tight text-blue-600">Tk. {calculateTotal().toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm pt-2">
                                        <span className="text-green-600 font-medium tracking-wide">Paid</span>
                                        <span className="font-mono text-green-700 font-bold">Tk. {paidAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm pt-1 border-t border-gray-200">
                                        <span className="text-orange-600 font-medium tracking-wide">Due</span>
                                        <span className="font-mono text-orange-700 font-bold">Tk. {(calculateTotal() - paidAmount).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button 
                        onClick={() => setShowNewSaleModal(false)}
                        className="px-6 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-colors shadow-sm"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSaveSale}
                        disabled={!clientName || saleItems.length === 0 || isSaving}
                        className="px-8 py-2 bg-[#0f172a] text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {isSaving ? 'Saving...' : 'Save Sale'}
                    </button>
                </div>
            </div>
          </div>
      )}
    </div>
  );
}
