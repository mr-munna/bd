export interface BillItem {
  id: string;
  areaName: string;
  tiles: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
}

export interface Bill {
  id: string;
  type: 'BILL' | 'QUOTATION';
  billNumber: string;
  date: string;
  recipientName: string;
  site: string;
  subject: string;
  items: BillItem[];
  totalInWords: string;
  grandTotal: number;
  preparedBy: string;
  signature?: string | null;
  termsAndConditions?: string | null;
  timestamp: string;
  revision: number;
}

export interface PDFSettings {
  companyName: string;
  address: string;
  email: string;
  contact: string;
  logo?: string;
  hideNameText: boolean;
  headerBgColor: string;
  headerTextColor: string;
  footerBgColor: string;
  footerTextColor: string;
  fontStyle: string;
}

export const DEFAULT_PDF_SETTINGS: PDFSettings = {
  companyName: 'YOUR COMPANY NAME',
  address: '123 Business Street, City, Country',
  email: 'info@company.com',
  contact: '+880 1682 799198',
  hideNameText: false,
  headerBgColor: '#FFFFFF',
  headerTextColor: '#000000',
  footerBgColor: '#FFFFFF',
  footerTextColor: '#000000',
  fontStyle: 'helvetica'
};
