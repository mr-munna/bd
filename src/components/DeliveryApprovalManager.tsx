import React, { useState, useEffect, useMemo } from 'react';
import { 
  db, 
  auth 
} from '../firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { 
  FileText, 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Printer, 
  Download, 
  Trash2, 
  Calendar, 
  User, 
  Phone, 
  MapPin, 
  Info, 
  ShieldAlert, 
  Check, 
  X,
  Package,
  Grid3X3,
  Wrench,
  Loader2,
  Truck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Tile, Good, Tool, DeliveryApproval, DeliveryApprovalItem, UserDoc } from '../types';

interface DeliveryApprovalManagerProps {
  user: any;
  currentUserDoc: UserDoc | null;
  isSupremeAdmin: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  tiles: Tile[];
  goods: Good[];
  tools: Tool[];
  users?: UserDoc[];
}

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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const resolveUserDisplay = (
  savedName: string | undefined | null,
  userId: string | undefined | null,
  usersList: UserDoc[] = []
): string => {
  if (!savedName) return '';
  const cleanName = savedName.replace(/\s*\(Rejected\)/i, '').trim();
  const isRejected = savedName.toLowerCase().includes('(rejected)');

  if (cleanName && cleanName !== 'Unknown User' && cleanName !== 'Admin' && cleanName !== 'anonymous' && !cleanName.includes('Unknown User')) {
    return savedName;
  }

  // Look up by userId
  if (userId && userId !== 'anonymous') {
    const matchedUser = usersList.find(u => u.id === userId);
    if (matchedUser) {
      const hasRealName = matchedUser.displayName && matchedUser.displayName !== 'Unknown User' && matchedUser.displayName.trim() !== '';
      const resolved = hasRealName ? matchedUser.displayName : matchedUser.email;
      return isRejected ? `${resolved} (Rejected)` : resolved;
    }
  }

  return savedName;
};

export const DeliveryApprovalManager: React.FC<DeliveryApprovalManagerProps> = ({
  user,
  currentUserDoc,
  isSupremeAdmin,
  isSuperAdmin,
  isAdmin,
  tiles,
  goods,
  tools,
  users = []
}) => {
  const [approvals, setApprovals] = useState<DeliveryApproval[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [itemsList, setItemsList] = useState<DeliveryApprovalItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState('pcs');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [reference, setReference] = useState('');
  const [remark, setRemark] = useState('');
  
  // Transport & Delivery Challan fields
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [gatePassNo, setGatePassNo] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter State
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [textSearch, setTextSearch] = useState('');

  // Print/Preview Modal State
  const [previewApproval, setPreviewApproval] = useState<DeliveryApproval | null>(null);

  // Real-time listener for delivery approvals
  useEffect(() => {
    if (!user || !currentUserDoc) {
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'delivery_approvals'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: DeliveryApproval[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as DeliveryApproval);
      });
      setApprovals(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching delivery approvals:", error);
      toast.error("Failed to load delivery approvals");
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'delivery_approvals');
    });

    return () => unsubscribe();
  }, [user, currentUserDoc]);

  // Filtered inventory matches for autocomplete/suggestion
  const suggestedItems = useMemo(() => {
    if (!productSearch.trim()) return [];
    const queryStr = productSearch.toLowerCase().trim();

    // Search in tiles
    const tileMatches = tiles
      .filter(t => !t.deleted && (t.name.toLowerCase().includes(queryStr) || t.brand.toLowerCase().includes(queryStr)))
      .map(t => ({
        id: t.id,
        type: 'tile' as const,
        name: t.name,
        code: t.brand, // Use brand as identifier if code is missing, or construct it
        brand: t.brand,
        size: t.size,
        stockMsg: `${t.totalSft || 0} sft / ${t.totalPcs || 0} pcs`,
        unitDefault: 'sft',
        original: t
      }));

    // Search in goods
    const goodMatches = goods
      .filter(g => !g.deleted && (g.description.toLowerCase().includes(queryStr) || g.brand.toLowerCase().includes(queryStr) || g.code.toLowerCase().includes(queryStr)))
      .map(g => ({
        id: g.id,
        type: 'good' as const,
        name: `${g.brand} - ${g.description}`,
        code: g.code,
        brand: g.brand,
        size: 'N/A',
        stockMsg: `${(g.dokhinkhan || 0) + (g.bonorupa || 0) + (g.banani || 0)} pcs`,
        unitDefault: 'pcs',
        original: g
      }));

    // Search in tools
    const toolMatches = tools
      .filter(t => !t.deleted && t.details.toLowerCase().includes(queryStr))
      .map(t => ({
        id: t.id,
        type: 'tool' as const,
        name: t.details,
        code: 'TOOL',
        brand: 'N/A',
        size: 'N/A',
        stockMsg: `${t.qty || 0} pcs`,
        unitDefault: 'pcs',
        original: t
      }));

    return [...tileMatches, ...goodMatches, ...toolMatches].slice(0, 10);
  }, [productSearch, tiles, goods, tools]);

  // Handle selecting a product from suggestions
  const handleSelectProduct = (item: any) => {
    setSelectedProduct(item);
    setProductSearch(`${item.name} (${item.code})`);
    setUnit(item.unitDefault);
  };

  // Add item to local challan items list
  const handleAddItem = () => {
    if (!selectedProduct && !productSearch.trim()) {
      toast.error("Please enter or select a product to add");
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    const code = selectedProduct ? selectedProduct.code : 'CUSTOM';
    const name = selectedProduct ? selectedProduct.name : productSearch;
    const size = selectedProduct ? selectedProduct.size : 'N/A';
    const brand = selectedProduct ? selectedProduct.brand : 'N/A';

    const isDuplicate = itemsList.some(item => 
      item.productCode === code && 
      item.productName === name && 
      item.size === size && 
      item.brand === brand
    );

    if (isDuplicate) {
      toast.error("This product is already added to the challan.");
      return;
    }

    const newItem: DeliveryApprovalItem = {
      productCode: code,
      productName: name,
      size: size,
      brand: brand,
      quantity: Number(quantity),
      unit: unit
    };

    setItemsList([...itemsList, newItem]);
    toast.success("Product added to list");

    // Clear current product inputs
    setProductSearch('');
    setSelectedProduct(null);
    setQuantity('');
  };

  const handleRemoveItem = (index: number) => {
    setItemsList(itemsList.filter((_, idx) => idx !== index));
    toast.success("Product removed");
  };

  // Handle request submission
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalItems = [...itemsList];

    // Fallback: if list is empty but user filled the inputs, auto-add
    if (finalItems.length === 0) {
      if ((selectedProduct || productSearch.trim()) && quantity && Number(quantity) > 0) {
        const code = selectedProduct ? selectedProduct.code : 'CUSTOM';
        const name = selectedProduct ? selectedProduct.name : productSearch;
        const size = selectedProduct ? selectedProduct.size : 'N/A';
        const brand = selectedProduct ? selectedProduct.brand : 'N/A';
        finalItems.push({
          productCode: code,
          productName: name,
          size: size,
          brand: brand,
          quantity: Number(quantity),
          unit: unit
        });
      } else {
        toast.error("Please add at least one product to the challan");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // For legacy rendering compatibility, we also save the first item's details at top-level
      const firstItem = finalItems[0];

      const docData = {
        items: finalItems,
        productCode: firstItem.productCode,
        productName: firstItem.productName,
        size: firstItem.size,
        brand: firstItem.brand,
        quantity: firstItem.quantity,
        unit: firstItem.unit,
        clientName: clientName.trim() || 'N/A',
        clientPhone: clientPhone.trim() || 'N/A',
        siteAddress: siteAddress.trim() || 'N/A',
        reference: reference.trim() || 'N/A',
        remark: remark.trim() || 'N/A',
        vehicleNumber: vehicleNumber.trim() || 'N/A',
        driverName: driverName.trim() || 'N/A',
        driverPhone: driverPhone.trim() || 'N/A',
        gatePassNo: gatePassNo.trim() || 'N/A',
        submittedBy: user?.uid || 'anonymous',
        submittedByName: (currentUserDoc?.displayName && currentUserDoc.displayName !== 'Unknown User' && currentUserDoc.displayName.trim() !== '') ? currentUserDoc.displayName : (user?.email || 'Unknown User'),
        createdAt: new Date().toISOString(),
        supremeApproved: false,
        supremeApprovedBy: '',
        superApproved: false,
        superApprovedBy: '',
        status: 'pending' as const
      };

      await addDoc(collection(db, 'delivery_approvals'), docData);
      toast.success("Delivery request submitted successfully!");
      
      // Clear form
      setItemsList([]);
      setProductSearch('');
      setSelectedProduct(null);
      setQuantity('');
      setClientName('');
      setClientPhone('');
      setSiteAddress('');
      setReference('');
      setRemark('');
      setVehicleNumber('');
      setDriverName('');
      setDriverPhone('');
      setGatePassNo('');
    } catch (error: any) {
      console.error("Submission error:", error);
      toast.error(`Submission failed: ${error.message}`);
      handleFirestoreError(error, OperationType.CREATE, 'delivery_approvals');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Approve request
  const handleApprove = async (approvalId: string, role: 'supreme' | 'super') => {
    try {
      const item = approvals.find(a => a.id === approvalId);
      if (!item) return;

      const updates: Partial<DeliveryApproval> = {};
      const approverName = (currentUserDoc?.displayName && currentUserDoc.displayName !== 'Unknown User' && currentUserDoc.displayName.trim() !== '') ? currentUserDoc.displayName : (user?.email || 'Admin');

      if (role === 'supreme') {
        updates.supremeApproved = true;
        updates.supremeApprovedBy = approverName;
      } else if (role === 'super') {
        updates.superApproved = true;
        updates.superApprovedBy = approverName;
      }

      // Re-evaluate combined status - either Supreme or Super admin approval is sufficient
      const willBeSupremeApproved = role === 'supreme' ? true : item.supremeApproved;
      const willBeSuperApproved = role === 'super' ? true : item.superApproved;

      if (willBeSupremeApproved || willBeSuperApproved) {
        updates.status = 'approved';
      } else {
        updates.status = 'pending';
      }

      await updateDoc(doc(db, 'delivery_approvals', approvalId), updates);
      toast.success(`Approved as ${role === 'supreme' ? 'Supreme' : 'Super'} Admin`);
    } catch (error: any) {
      toast.error(`Approval failed: ${error.message}`);
      handleFirestoreError(error, OperationType.UPDATE, `delivery_approvals/${approvalId}`);
    }
  };

  // Reject request
  const handleReject = async (approvalId: string, role: 'supreme' | 'super') => {
    try {
      const updates: Partial<DeliveryApproval> = {
        status: 'rejected'
      };
      const approverName = (currentUserDoc?.displayName && currentUserDoc.displayName !== 'Unknown User' && currentUserDoc.displayName.trim() !== '') ? currentUserDoc.displayName : (user?.email || 'Admin');

      if (role === 'supreme') {
        updates.supremeApproved = false;
        updates.supremeApprovedBy = `${approverName} (Rejected)`;
      } else if (role === 'super') {
        updates.superApproved = false;
        updates.superApprovedBy = `${approverName} (Rejected)`;
      }

      await updateDoc(doc(db, 'delivery_approvals', approvalId), updates);
      toast.error("Delivery request rejected");
    } catch (error: any) {
      toast.error(`Rejection failed: ${error.message}`);
      handleFirestoreError(error, OperationType.UPDATE, `delivery_approvals/${approvalId}`);
    }
  };

  // Delete Request
  const handleDelete = async (approvalId: string) => {
    if (!isSupremeAdmin && !isSuperAdmin) {
      toast.error("Only Supreme and Super Admins are allowed to delete.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this request permanently?")) return;
    try {
      await deleteDoc(doc(db, 'delivery_approvals', approvalId));
      toast.success("Request deleted successfully");
    } catch (error: any) {
      toast.error(`Deletion failed: ${error.message}`);
      handleFirestoreError(error, OperationType.DELETE, `delivery_approvals/${approvalId}`);
    }
  };

  // Filtered list
  const filteredApprovals = useMemo(() => {
    return approvals.filter(item => {
      // Filter status
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending' && (item.status !== 'pending' && item.status !== 'partially_approved')) return false;
        if (statusFilter === 'approved' && item.status !== 'approved') return false;
        if (statusFilter === 'rejected' && item.status !== 'rejected') return false;
      }

      // Filter text
      if (textSearch.trim()) {
        const term = textSearch.toLowerCase().trim();
        return (
          item.productName.toLowerCase().includes(term) ||
          item.productCode.toLowerCase().includes(term) ||
          (item.clientName && item.clientName.toLowerCase().includes(term)) ||
          (item.submittedByName && item.submittedByName.toLowerCase().includes(term))
        );
      }

      return true;
    });
  }, [approvals, statusFilter, textSearch]);

  const handlePrint = (item: DeliveryApproval) => {
    setPreviewApproval(item);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const downloadChallanHTML = (item: DeliveryApproval) => {
    const itemsToRender = item.items && item.items.length > 0 
      ? item.items 
      : [{
          productName: item.productName || 'N/A',
          productCode: item.productCode || 'N/A',
          size: item.size,
          brand: item.brand,
          quantity: item.quantity || 0,
          unit: item.unit || 'pcs'
        }];

    const dateStr = new Date(item.createdAt).toLocaleDateString();
    const challanId = item.id.substring(0, 8).toUpperCase();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Delivery Challan - ${challanId}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #1a1a1a;
      line-height: 1.5;
      padding: 40px;
      margin: 0;
      background-color: #ffffff;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #e2e8f0;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #1a202c;
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    .company-title {
      font-size: 24px;
      font-weight: 900;
      text-transform: uppercase;
      margin: 0 0 5px 0;
      letter-spacing: -0.5px;
    }
    .company-subtitle {
      font-size: 13px;
      color: #4a5568;
      margin: 0 0 5px 0;
      font-weight: 500;
    }
    .company-details {
      font-size: 11px;
      color: #718096;
      margin: 0;
    }
    .challan-title-box {
      text-align: right;
    }
    .challan-badge {
      background-color: #f7fafc;
      border: 1px solid #e2e8f0;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 18px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 0;
      display: inline-block;
    }
    .challan-meta {
      font-size: 11px;
      color: #718096;
      margin-top: 8px;
    }
    .challan-id {
      font-family: monospace;
      font-weight: bold;
      color: #1a202c;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background-color: #f8fafc;
      border: 1px solid #f1f5f9;
      padding: 15px;
      border-radius: 10px;
      font-size: 12px;
    }
    .card-title {
      font-weight: 800;
      color: #1a202c;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 5px;
      margin: 0 0 10px 0;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    .card p {
      margin: 5px 0;
      color: #4a5568;
    }
    .card .bold-label {
      font-weight: bold;
      color: #2d3748;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
      font-size: 12px;
    }
    th {
      background-color: #f1f5f9;
      border-top: 2px solid #1a202c;
      border-bottom: 2px solid #1a202c;
      padding: 10px;
      font-weight: bold;
      text-align: left;
      text-transform: uppercase;
    }
    td {
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 10px;
    }
    .center {
      text-align: center;
    }
    .right {
      text-align: right;
    }
    .bold {
      font-weight: bold;
    }
    .remark-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 12px;
      border-radius: 8px;
      font-size: 12px;
      margin-bottom: 40px;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      text-align: center;
      font-size: 10px;
      margin-top: 50px;
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
    }
    .sig-line {
      border-top: 1px solid #718096;
      padding-top: 5px;
      font-weight: bold;
      color: #4a5568;
      text-transform: uppercase;
    }
    .sig-sub {
      color: #a0aec0;
      font-family: monospace;
      margin-top: 2px;
    }
    .no-print-btn {
      display: block;
      width: 100%;
      max-width: 200px;
      margin: 20px auto 0 auto;
      padding: 10px 20px;
      background-color: #3182ce;
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      text-align: center;
    }
    .no-print-btn:hover {
      background-color: #2b6cb0;
    }
    @media print {
      body {
        padding: 0;
      }
      .container {
        border: none;
        box-shadow: none;
        padding: 0;
      }
      .no-print-btn {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h2 class="company-title">BAROBI DESIGN</h2>
        <p class="company-subtitle">Importer of Premium Building Products</p>
        <p class="company-details">Dhaka, Banani, Bangladesh | Tel: +8802 9821286 | Email: barobidesign@bsgrouponline.com</p>
      </div>
      <div class="challan-title-box">
        <h1 class="challan-badge">DELIVERY CHALLAN</h1>
        <div class="challan-meta">
          <p>Challan ID: <span class="challan-id">${challanId}</span></p>
          <p>Date: ${dateStr}</p>
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3 class="card-title">DELIVER TO:</h3>
        <p class="bold">${item.clientName || 'N/A'}</p>
        <p><span class="bold-label">Phone:</span> ${item.clientPhone || 'N/A'}</p>
        <p><span class="bold-label">Site Address:</span> ${item.siteAddress || 'N/A'}</p>
        <p><span class="bold-label">Reference:</span> ${item.reference || 'N/A'}</p>
      </div>

      <div class="card">
        <h3 class="card-title">TRANSPORT INFO:</h3>
        <p><span class="bold-label">Vehicle No:</span> ${item.vehicleNumber || 'N/A'}</p>
        <p><span class="bold-label">Gate Pass No:</span> ${item.gatePassNo || 'N/A'}</p>
        <p><span class="bold-label">Driver:</span> ${item.driverName || 'N/A'} ${item.driverPhone && item.driverPhone !== 'N/A' ? '(' + item.driverPhone + ')' : ''}</p>
      </div>

      <div class="card">
        <h3 class="card-title">ORDER METADATA:</h3>
        <p><span class="bold-label">Supreme Admin:</span> ${resolveUserDisplay(item.supremeApprovedBy, null, users) || 'Cleared'}</p>
        <p><span class="bold-label">Super Admin:</span> ${resolveUserDisplay(item.superApprovedBy, null, users) || 'Cleared'}</p>
        <p><span class="bold-label">Requisition:</span> ${resolveUserDisplay(item.submittedByName, item.submittedBy, users)}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 50px;">SL</th>
          <th>Product Details</th>
          <th class="center">Product Code</th>
          <th class="center">Size</th>
          <th class="center">Brand</th>
          <th class="right">Quantity</th>
          <th class="center">Unit</th>
        </tr>
      </thead>
      <tbody>
        ${itemsToRender.map((sub, idx) => `
          <tr>
            <td style="font-family: monospace;">${String(idx + 1).padStart(2, '0')}</td>
            <td class="bold">${sub.productName}</td>
            <td class="center" style="font-family: monospace;">${sub.productCode}</td>
            <td class="center">${sub.size || 'N/A'}</td>
            <td class="center">${sub.brand || 'N/A'}</td>
            <td class="right bold">${sub.quantity}</td>
            <td class="center bold">${sub.unit}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    ${item.remark && item.remark !== 'N/A' ? `
      <div class="remark-box">
        <span class="bold">Remark / Instructions:</span> ${item.remark}
      </div>
    ` : ''}

    <div class="signatures">
      <div>
        <div class="sig-line">PREPARED BY</div>
        <p class="sig-sub">${resolveUserDisplay(item.submittedByName, item.submittedBy, users)}</p>
      </div>
      <div>
        <div class="sig-line">SUPER ADMIN APPROVAL</div>
        <p class="sig-sub">${resolveUserDisplay(item.superApprovedBy, null, users) || 'Cleared'}</p>
      </div>
      <div>
        <div class="sig-line">SUPREME ADMIN APPROVAL</div>
        <p class="sig-sub">${resolveUserDisplay(item.supremeApprovedBy, null, users) || 'Cleared'}</p>
      </div>
      <div>
        <div class="sig-line">RECEIVER SIGNATURE</div>
        <p class="sig-sub" style="color: #cbd5e1;">Sign & Date</p>
      </div>
    </div>

    <button class="no-print-btn" onclick="window.print()">Print This Document</button>
  </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Challan-${challanId}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Offline Challan Document downloaded!");
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8 no-print">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-900 rounded-3xl p-6 md:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
              <Truck className="w-8 h-8 text-blue-400" /> Delivery Approval Center
            </h1>
            <p className="text-blue-100 text-sm max-w-xl">
              Submit product deliveries for authorizations. Print/Download approved challans instantly.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-3 py-1.5 bg-white/10 rounded-full border border-white/20 uppercase tracking-wider text-blue-200">
              Role: {currentUserDoc?.role?.replace('_', ' ') || 'Guest'}
            </span>
            <span className="text-xs font-semibold px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30 uppercase tracking-wider">
              System Online
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Create Request Form */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-100 shadow-xl p-6 h-fit space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" /> Delivery Challan Form
            </h2>
            <p className="text-xs text-gray-500 mt-1">Fill out item, transport & client details for delivery clearance.</p>
          </div>

          <form onSubmit={handleSubmitRequest} className="space-y-4">
            {/* Product search/suggest */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold text-gray-700 block">Product Name / Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Type product code or name..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    if (selectedProduct && e.target.value !== `${selectedProduct.name} (${selectedProduct.code})`) {
                      setSelectedProduct(null);
                    }
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Suggestions dropdown */}
              {productSearch && suggestedItems.length > 0 && !selectedProduct && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 shadow-2xl rounded-xl max-h-60 overflow-y-auto z-50 p-1 space-y-1">
                  {suggestedItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectProduct(item)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex items-center justify-between gap-3 group transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-900 group-hover:text-blue-600">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          Code: {item.code} | Size: {item.size}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                        Stock: {item.stockMsg}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Product info card */}
            {selectedProduct && (
              <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-blue-800 font-bold uppercase tracking-wider text-[10px]">
                  {selectedProduct.type === 'tile' && <Grid3X3 className="w-3.5 h-3.5" />}
                  {selectedProduct.type === 'good' && <Package className="w-3.5 h-3.5" />}
                  {selectedProduct.type === 'tool' && <Wrench className="w-3.5 h-3.5" />}
                  Selected {selectedProduct.type} item
                </div>
                <p className="font-bold text-slate-900 text-sm">{selectedProduct.name}</p>
                <div className="grid grid-cols-2 gap-2 text-gray-600 mt-1">
                  <div><span className="font-semibold text-gray-500">Code:</span> {selectedProduct.code}</div>
                  <div><span className="font-semibold text-gray-500">Size:</span> {selectedProduct.size}</div>
                  <div className="col-span-2 text-emerald-800 font-bold bg-emerald-100/40 p-1.5 rounded flex justify-between">
                    <span>Stock Available:</span>
                    <span>{selectedProduct.stockMsg}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quantity and Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Quantity</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Unit</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="pcs">Pcs (Pieces)</option>
                  <option value="sft">Sft (Sqr Feet)</option>
                  <option value="box">Box</option>
                  <option value="set">Set</option>
                </select>
              </div>
            </div>

            {/* Add to Challan Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleAddItem}
                className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
              >
                <Plus className="w-4 h-4 text-blue-700" /> Add Product to Challan
              </button>
            </div>

            {/* Added Items List */}
            {itemsList.length > 0 && (
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Challan Products List ({itemsList.length})</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {itemsList.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{item.productName}</p>
                        <p className="text-[10px] text-gray-500">
                          Code: {item.productCode} {item.size && item.size !== 'N/A' && `| Size: ${item.size}`} {item.brand && item.brand !== 'N/A' && `| Brand: ${item.brand}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                          {item.quantity} {item.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Remove item"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Client name and Phone */}
            <div className="space-y-3 border-t border-gray-100 pt-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Client Name</label>
                <input
                  type="text"
                  placeholder="Enter client name..."
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Client Phone</label>
                <input
                  type="text"
                  placeholder="Enter client phone..."
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Site / Delivery Address</label>
                <input
                  type="text"
                  placeholder="Enter site address..."
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Reference</label>
                <input
                  type="text"
                  placeholder="Enter reference..."
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Transport & Gate Pass Details */}
              <div className="space-y-3 border-t border-gray-100 pt-3">
                <h4 className="text-xs font-extrabold text-blue-700 uppercase tracking-wider">Transport Details (Challan Info)</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-700 block">Vehicle Number</label>
                    <input
                      type="text"
                      placeholder="e.g. Dhaka Metro-U-11"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-700 block">Gate Pass No</label>
                    <input
                      type="text"
                      placeholder="e.g. GP-987"
                      value={gatePassNo}
                      onChange={(e) => setGatePassNo(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-700 block">Driver Name</label>
                    <input
                      type="text"
                      placeholder="Enter driver name"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-700 block">Driver Phone</label>
                    <input
                      type="text"
                      placeholder="Enter driver phone"
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Remark / Note</label>
                <textarea
                  placeholder="Any delivery instructions..."
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none h-16 resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Submit Request
                </>
              )}
            </button>
          </form>
        </div>

        {/* Requests List */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-100 shadow-xl p-6 space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-gray-900">Delivery Clearance Queue</h2>
              <p className="text-xs text-gray-500">Track and authorize active delivery orders.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search bar */}
              <div className="relative w-full md:w-48">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search order..."
                  value={textSearch}
                  onChange={(e) => setTextSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Status filter tabs */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/50">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all ${
                      statusFilter === tab 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
              <p className="text-sm font-medium text-gray-500">Syncing live approvals queue...</p>
            </div>
          ) : filteredApprovals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-2 border-2 border-dashed border-gray-100 rounded-2xl">
              <Info className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-bold text-slate-800">No requests found</p>
              <p className="text-xs text-slate-400 max-w-xs">There are no delivery requests matching the active filter.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {filteredApprovals.map((item) => {
                const isFullyCleared = item.supremeApproved || item.superApproved || item.status === 'approved';
                const canPrint = isFullyCleared;

                const itemsToRender = item.items && item.items.length > 0 
                  ? item.items 
                  : [{
                      productName: item.productName || 'N/A',
                      productCode: item.productCode || 'N/A',
                      size: item.size,
                      brand: item.brand,
                      quantity: item.quantity || 0,
                      unit: item.unit || 'pcs'
                    }];

                return (
                  <div 
                    key={item.id} 
                    className={`border rounded-2xl p-4 transition-all shadow-sm relative overflow-hidden flex flex-col md:flex-row justify-between gap-6 hover:shadow-md ${
                      item.status === 'approved' ? 'border-emerald-200 bg-emerald-50/10' :
                      item.status === 'rejected' ? 'border-rose-200 bg-rose-50/10' :
                      item.status === 'partially_approved' ? 'border-amber-200 bg-amber-50/10' :
                      'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    {/* Status side bar indicator */}
                    <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                      item.status === 'approved' ? 'bg-emerald-500' :
                      item.status === 'rejected' ? 'bg-rose-500' :
                      item.status === 'partially_approved' ? 'bg-amber-500' :
                      'bg-slate-300'
                    }`}></div>

                    {/* Left Column: Order details */}
                    <div className="space-y-3 pl-2.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          item.status === 'approved' ? 'bg-emerald-100 text-emerald-850' :
                          item.status === 'rejected' ? 'bg-rose-100 text-rose-850' :
                          item.status === 'partially_approved' ? 'bg-amber-100 text-amber-850' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {item.status.replace('_', ' ')}
                        </span>
                        
                        <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'N/A'}
                        </span>
                      </div>

                      {/* Products List Rendering */}
                      <div className="space-y-1.5 bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Challan Products ({itemsToRender.length})</p>
                        <div className="divide-y divide-slate-150">
                          {itemsToRender.map((sub, idx) => (
                            <div key={idx} className="py-1.5 flex justify-between items-start gap-4 text-xs">
                              <div className="min-w-0">
                                <span className="font-bold text-slate-800 break-words">{sub.productName}</span>
                                <span className="text-[10px] text-slate-500 font-mono ml-2">({sub.productCode})</span>
                                {((sub.size && sub.size !== 'N/A') || (sub.brand && sub.brand !== 'N/A')) && (
                                  <span className="text-[10px] text-slate-400 block mt-0.5">
                                    {sub.size && sub.size !== 'N/A' && `Size: ${sub.size} `}
                                    {sub.brand && sub.brand !== 'N/A' && `| Brand: ${sub.brand}`}
                                  </span>
                                )}
                              </div>
                              <div className="text-right font-extrabold text-blue-900 shrink-0">
                                {sub.quantity} <span className="text-[10px] font-medium text-slate-500">{sub.unit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Client Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate"><span className="text-slate-400">Client:</span> {item.clientName || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate"><span className="text-slate-400">Phone:</span> {item.clientPhone || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-1 sm:col-span-3 border-t border-slate-200/50 pt-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate"><span className="text-slate-400">Site:</span> {item.siteAddress || 'N/A'}</span>
                        </div>
                        {item.reference && item.reference !== 'N/A' && (
                          <div className="flex items-center gap-1.5 col-span-1 sm:col-span-3 border-t border-slate-200/50 pt-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate"><span className="text-slate-400">Reference:</span> {item.reference}</span>
                          </div>
                        )}
                      </div>

                      {/* Transport Details */}
                      {(item.vehicleNumber || item.gatePassNo || item.driverName) && (
                        <div className="flex flex-wrap gap-2 text-[10px] bg-blue-50/50 p-2 rounded-xl border border-blue-100/30 text-blue-800">
                          {item.vehicleNumber && item.vehicleNumber !== 'N/A' && (
                            <span className="flex items-center gap-1 font-semibold">
                              <Truck className="w-3 h-3" /> Veh: {item.vehicleNumber}
                            </span>
                          )}
                          {item.gatePassNo && item.gatePassNo !== 'N/A' && (
                            <span className="border-l border-blue-200/60 pl-1.5 font-semibold">
                              Gate Pass: {item.gatePassNo}
                            </span>
                          )}
                          {item.driverName && item.driverName !== 'N/A' && (
                            <span className="border-l border-blue-200/60 pl-1.5 font-medium text-slate-600">
                              Driver: {item.driverName} {item.driverPhone && item.driverPhone !== 'N/A' && `(${item.driverPhone})`}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Submitted by details */}
                      <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                        <span>Submitted by:</span>
                        <span className="font-bold text-gray-600">{resolveUserDisplay(item.submittedByName, item.submittedBy, users)}</span>
                        {item.remark && item.remark !== 'N/A' && (
                          <span className="italic text-gray-500 border-l border-gray-200 pl-2 ml-2">"{item.remark}"</span>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Qty & Authorization badges */}
                    <div className="flex flex-col justify-between items-end gap-4 shrink-0 min-w-[200px]">
                      {/* Qty pill */}
                      <div className="text-right">
                        <p className="text-2xl font-black text-slate-950 font-mono flex items-baseline gap-1 justify-end">
                          {item.items && item.items.length > 0 
                            ? item.items.reduce((acc, sub) => acc + (sub.quantity || 0), 0)
                            : item.quantity}
                          <span className="text-xs font-bold text-gray-500 uppercase">
                            {item.items && item.items.length > 0 ? 'Total' : item.unit}
                          </span>
                        </p>
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                          {item.items && item.items.length > 0 ? `${item.items.length} Product Types` : 'Order Quantity'}
                        </p>
                      </div>

                      {/* Approval Double Badges */}
                      <div className="flex flex-col gap-2 w-full">
                        {/* Supreme Admin badge status */}
                        <div className="flex items-center justify-between text-xs border border-gray-100 bg-white px-2.5 py-1.5 rounded-xl gap-3 shadow-xs">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">Supreme Admin</span>
                          <span className={`font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            item.supremeApproved 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {item.supremeApproved ? <Check className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                            {item.supremeApproved ? 'Approved' : 'Pending'}
                          </span>
                        </div>

                        {/* Super Admin badge status */}
                        <div className="flex items-center justify-between text-xs border border-gray-100 bg-white px-2.5 py-1.5 rounded-xl gap-3 shadow-xs">
                          <span className="text-[10px] font-bold text-gray-500 uppercase">Super Admin</span>
                          <span className={`font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            item.superApproved 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {item.superApproved ? <Check className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                            {item.superApproved ? 'Approved' : 'Pending'}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons (Approve / Reject / Print / Delete) */}
                      <div className="flex items-center gap-1.5 w-full justify-end flex-wrap">
                        {/* Supreme Admin Action buttons */}
                        {isSupremeAdmin && (
                          <div className="flex gap-1.5">
                            {!item.supremeApproved && (
                              <button
                                onClick={() => handleApprove(item.id, 'supreme')}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition-colors"
                                title="Approve as Supreme Admin"
                              >
                                <Check className="w-3 h-3" /> Approve (Supreme)
                              </button>
                            )}
                            {item.status !== 'rejected' && (
                              <button
                                onClick={() => handleReject(item.id, 'supreme')}
                                className="p-1 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg"
                                title="Reject as Supreme Admin"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Super Admin Action buttons */}
                        {isSuperAdmin && (
                          <div className="flex gap-1.5">
                            {!item.superApproved && (
                              <button
                                onClick={() => handleApprove(item.id, 'super')}
                                className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition-colors"
                                title="Approve as Super Admin"
                              >
                                <Check className="w-3 h-3" /> Approve (Super)
                              </button>
                            )}
                            {item.status !== 'rejected' && (
                              <button
                                onClick={() => handleReject(item.id, 'super')}
                                className="p-1 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg"
                                title="Reject as Super Admin"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}

                         {/* Print / Download Buttons (Only visible when fully cleared) */}
                        {canPrint && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handlePrint(item)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-md transition-colors"
                              title="Print / Preview Delivery Challan"
                            >
                              <Printer className="w-3.5 h-3.5" /> Print
                            </button>
                            <button
                              onClick={() => downloadChallanHTML(item)}
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-md transition-colors"
                              title="Download Offline Printable Challan"
                            >
                              <Download className="w-3.5 h-3.5" /> Download
                            </button>
                          </div>
                        )}

                        {/* Delete Button (Super Admin / Supreme Admin only) */}
                        {(isSuperAdmin || isSupremeAdmin) && (
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors"
                            title="Delete Request"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Embedded print container style strictly for document printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-section, .print-section * {
            visibility: visible;
          }
          .print-section {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 20px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Hidden high-fidelity delivery challan printed document */}
      {previewApproval && (
        <div className="print-section hidden bg-white text-black p-8 font-sans space-y-8 max-w-4xl mx-auto border border-gray-150">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-gray-900 pb-6">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-black tracking-tight uppercase">BAROBI DESIGN</h2>
              <p className="text-xs text-gray-600 font-medium">Importer of Premium Building Products</p>
              <p className="text-[10px] text-gray-500">Dhaka, Banani, Bangladesh | Tel: +8802 9821286 | Email: barobidesign@bsgrouponline.com</p>
            </div>
            <div className="text-right space-y-1">
              <h1 className="text-xl font-black text-gray-800 uppercase tracking-widest bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                DELIVERY CHALLAN
              </h1>
              <p className="text-xs text-gray-500 font-mono mt-1">Challan ID: <span className="font-bold text-gray-900">{previewApproval.id.substring(0, 8).toUpperCase()}</span></p>
              <p className="text-[10px] text-gray-500">Date: {new Date(previewApproval.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Addresses & Transport */}
          <div className="grid grid-cols-3 gap-6 text-[11px]">
            <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h3 className="font-extrabold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-1">DELIVER TO:</h3>
              <p className="font-bold text-gray-900">{previewApproval.clientName || 'N/A'}</p>
              <p className="text-gray-600 font-medium"><span className="font-bold">Phone:</span> {previewApproval.clientPhone || 'N/A'}</p>
              <p className="text-gray-600 font-medium"><span className="font-bold">Site Address:</span> {previewApproval.siteAddress || 'N/A'}</p>
              <p className="text-gray-600 font-medium"><span className="font-bold">Reference:</span> {previewApproval.reference || 'N/A'}</p>
            </div>

            <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h3 className="font-extrabold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-1">TRANSPORT INFO:</h3>
              <p className="text-gray-600 font-medium"><span className="font-bold text-gray-850">Vehicle No:</span> {previewApproval.vehicleNumber || 'N/A'}</p>
              <p className="text-gray-600 font-medium"><span className="font-bold text-gray-850">Gate Pass No:</span> {previewApproval.gatePassNo || 'N/A'}</p>
              <p className="text-gray-600 font-medium"><span className="font-bold text-gray-850">Driver:</span> {previewApproval.driverName || 'N/A'} {previewApproval.driverPhone && previewApproval.driverPhone !== 'N/A' && `(${previewApproval.driverPhone})`}</p>
            </div>

            <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h3 className="font-extrabold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-1">ORDER METADATA:</h3>
              <p className="text-gray-600 font-medium"><span className="font-bold text-gray-850">Supreme Admin:</span> {resolveUserDisplay(previewApproval.supremeApprovedBy, null, users) || 'Pending'}</p>
              <p className="text-gray-600 font-medium"><span className="font-bold text-gray-850">Super Admin:</span> {resolveUserDisplay(previewApproval.superApprovedBy, null, users) || 'Pending'}</p>
              <p className="text-gray-600 font-medium"><span className="font-bold text-gray-850">Requisition:</span> {resolveUserDisplay(previewApproval.submittedByName, previewApproval.submittedBy, users)}</p>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full border-collapse text-xs mt-6">
            <thead>
              <tr className="bg-gray-100 border-y-2 border-gray-900">
                <th className="py-2.5 px-3 font-extrabold text-left uppercase w-12">SL</th>
                <th className="py-2.5 px-3 font-extrabold text-left uppercase">Product Details</th>
                <th className="py-2.5 px-3 font-extrabold text-center uppercase">Product Code</th>
                <th className="py-2.5 px-3 font-extrabold text-center uppercase">Size</th>
                <th className="py-2.5 px-3 font-extrabold text-center uppercase">Brand</th>
                <th className="py-2.5 px-3 font-extrabold text-right uppercase">Quantity</th>
                <th className="py-2.5 px-3 font-extrabold text-center uppercase">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 border-b border-gray-400">
              {(() => {
                const printItems = previewApproval.items && previewApproval.items.length > 0
                  ? previewApproval.items
                  : [{
                      productName: previewApproval.productName || 'N/A',
                      productCode: previewApproval.productCode || 'N/A',
                      size: previewApproval.size,
                      brand: previewApproval.brand,
                      quantity: previewApproval.quantity || 0,
                      unit: previewApproval.unit || 'pcs'
                    }];

                return printItems.map((sub, idx) => (
                  <tr key={idx}>
                    <td className="py-3 px-3 font-mono">{String(idx + 1).padStart(2, '0')}</td>
                    <td className="py-3 px-3 font-bold text-gray-900">{sub.productName}</td>
                    <td className="py-3 px-3 text-center font-mono font-medium text-gray-700">{sub.productCode}</td>
                    <td className="py-3 px-3 text-center text-gray-700">{sub.size || 'N/A'}</td>
                    <td className="py-3 px-3 text-center text-gray-700">{sub.brand || 'N/A'}</td>
                    <td className="py-3 px-3 text-right font-black text-gray-900">{sub.quantity}</td>
                    <td className="py-3 px-3 text-center font-bold text-gray-600 uppercase">{sub.unit}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>

          {/* Remark section */}
          {previewApproval.remark && previewApproval.remark !== 'N/A' && (
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-150 text-xs">
              <span className="font-bold text-gray-800">Remark / Instructions:</span> {previewApproval.remark}
            </div>
          )}

          {/* Signatures section */}
          <div className="grid grid-cols-4 gap-4 text-center text-[10px] pt-16 mt-16 border-t border-gray-200">
            <div className="space-y-1">
              <div className="border-t border-gray-400 pt-1.5 font-bold text-gray-700 uppercase tracking-wide">PREPARED BY</div>
              <p className="text-gray-500 font-mono text-[9px]">{resolveUserDisplay(previewApproval.submittedByName, previewApproval.submittedBy, users)}</p>
            </div>
            <div className="space-y-1">
              <div className="border-t border-gray-400 pt-1.5 font-bold text-gray-700 uppercase tracking-wide">SUPER ADMIN APPROVAL</div>
              <p className="text-gray-500 font-mono text-[9px]">{resolveUserDisplay(previewApproval.superApprovedBy, null, users) || 'Cleared'}</p>
            </div>
            <div className="space-y-1">
              <div className="border-t border-gray-400 pt-1.5 font-bold text-gray-700 uppercase tracking-wide">SUPREME ADMIN APPROVAL</div>
              <p className="text-gray-500 font-mono text-[9px]">{resolveUserDisplay(previewApproval.supremeApprovedBy, null, users) || 'Cleared'}</p>
            </div>
            <div className="space-y-1">
              <div className="border-t border-gray-400 pt-1.5 font-bold text-gray-700 uppercase tracking-wide">RECEIVER SIGNATURE</div>
              <p className="text-gray-400 font-mono text-[9px]">Sign & Date</p>
            </div>
          </div>

          {/* Print instructions */}
          <div className="text-center text-[9px] text-gray-400 pt-8 border-t border-gray-100 no-print">
            Press Ctrl+P / Cmd+P to print. Select "Save as PDF" to download.
          </div>
        </div>
      )}
    </div>
  );
};
