export interface Tile {
  id: string;
  name: string;
  size: string;
  brand: string;
  totalSft: number;
  totalPcs: number;
  diaBariSft: number;
  diaBariPcs: number;
  diaBariRemark: string;
  bonorupaSft: number;
  bonorupaPcs: number;
  bonorupaRemark: string;
  bananiSft: number;
  bananiPcs: number;
  bananiRemark: string;
  imageUrl: string;
  deleted?: boolean;
}

export interface Good {
  id: string;
  brand: string;
  code: string;
  description: string;
  dokhinkhan: number;
  dokhinkhanRemark: string;
  bonorupa: number;
  bonorupaRemark: string;
  banani: number;
  bananiRemark: string;
  imageUrl: string;
  deleted?: boolean;
}

export interface Tool {
  id: string;
  details: string;
  qty: number;
  issueToDate: string;
  states: string;
  imageUrl: string;
  deleted?: boolean;
}

export interface BookedItem {
  id: string;
  name: string;
  size: string;
  code: string;
  brand: string;
  qtySft: number;
  qtyPcs: number;
  clientName: string;
  marketingPerson: string;
  remark: string;
  imageUrl: string;
}

export type Category = 'tiles' | 'goods' | 'tools' | 'bookedItems';
export type Tab = 'landing' | 'search' | 'master' | 'booked' | 'stock' | 'quote' | 'master_sheet' | 'users' | 'view_quote' | 'sales' | 'settings' | 'billing';

export type UserRole = 'supreme_admin' | 'super_admin' | 'admin' | 'user' | 'guest';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface UserDoc {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  displayName: string;
  photoURL?: string;
  createdAt: any;
  expiryDate?: string;
}

export interface SaleItem {
  id: string;
  type: 'tile' | 'good' | 'tool';
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  date: any;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  items: SaleItem[];
  subTotal: number;
  discount: number;
  discountPercent?: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: 'paid' | 'partial' | 'due';
  createdBy?: string;
}
