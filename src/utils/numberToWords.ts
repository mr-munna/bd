export function numberToWords(num: number): string {
  if (num === 0) return 'Zero';

  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const numStr = num.toString();
  if (numStr.length > 9) return 'Overflow';

  const n = ('000000000' + numStr).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';

  let str = '';
  str += (parseInt(n[1]) !== 0) ? (a[parseInt(n[1])] || b[n[1][0] as any] + ' ' + a[n[1][1] as any]) + ' Crore ' : '';
  str += (parseInt(n[2]) !== 0) ? (a[parseInt(n[2])] || b[n[2][0] as any] + ' ' + a[n[2][1] as any]) + ' Lakh ' : '';
  str += (parseInt(n[3]) !== 0) ? (a[parseInt(n[3])] || b[n[3][0] as any] + ' ' + a[n[3][1] as any]) + ' Thousand ' : '';
  str += (parseInt(n[4]) !== 0) ? (a[parseInt(n[4])] || b[n[4][0] as any] + ' ' + a[n[4][1] as any]) + ' Hundred ' : '';
  str += (parseInt(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[parseInt(n[5])] || b[n[5][0] as any] + ' ' + a[n[5][1] as any]) : '';

  return str.trim().replace(/\s+/g, ' ') + ' Only';
}
