/**
 * Formats monetary amounts into Indian currency formats (e.g. ₹12,50,000)
 * and translates numbers into Indian numbering system English words.
 */

export function formatIndianCurrency(num: number): string {
  if (num === undefined || num === null || isNaN(num)) {
    return '₹0';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
}

export function numberToIndianWords(num: number): string {
  if (num === undefined || num === null || isNaN(num)) {
    return 'Rupees Zero Only';
  }
  
  const integerPart = Math.floor(num);
  if (integerPart === 0) {
    return 'Rupees Zero Only';
  }

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function convertLessThanOneThousand(n: number): string {
    let temp = '';
    if (n >= 100) {
      temp += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      temp += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      temp += ones[n] + ' ';
    }
    return temp.trim();
  }

  let word = '';
  let tempNum = integerPart;

  const crore = Math.floor(tempNum / 10000000);
  tempNum %= 10000000;
  
  const lakh = Math.floor(tempNum / 100000);
  tempNum %= 100000;
  
  const thousand = Math.floor(tempNum / 1000);
  tempNum %= 1000;
  
  const remaining = tempNum;

  if (crore > 0) {
    word += convertLessThanOneThousand(crore) + ' Crore ';
  }
  if (lakh > 0) {
    word += convertLessThanOneThousand(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    word += convertLessThanOneThousand(thousand) + ' Thousand ';
  }
  if (remaining > 0) {
    word += convertLessThanOneThousand(remaining) + ' ';
  }

  return `Rupees ${word.trim()} Only`;
}

export function formatIndianDate(dateStr: string): string {
  if (!dateStr) return '';
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return dateStr;
  const day = parsed.getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const month = monthNames[parsed.getMonth()];
  const year = parsed.getFullYear();
  let ordinal = 'th';
  if (day === 1 || day === 21 || day === 31) ordinal = 'st';
  else if (day === 2 || day === 22) ordinal = 'nd';
  else if (day === 3 || day === 23) ordinal = 'rd';
  return `${day}${ordinal} ${month} ${year}`;
}
