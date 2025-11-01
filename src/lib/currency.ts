// Global currency utilities

export const formatCurrency = (amount: number, currency: string = 'ZAR'): string => {
  const formatters: Record<string, Intl.NumberFormat> = {
    ZAR: new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
    }),
    USD: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }),
    EUR: new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }),
    GBP: new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }),
    CAD: new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
    }),
    AUD: new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
    }),
    JPY: new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
    }),
    CHF: new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 2,
    }),
    CNY: new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
    }),
    INR: new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }),
    BRL: new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }),
    MXN: new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }),
    BWP: new Intl.NumberFormat('en-BW', {
      style: 'currency',
      currency: 'BWP',
      minimumFractionDigits: 2,
    }),
    NAD: new Intl.NumberFormat('en-NA', {
      style: 'currency',
      currency: 'NAD',
      minimumFractionDigits: 2,
    }),
    ZWL: new Intl.NumberFormat('en-ZW', {
      style: 'currency',
      currency: 'ZWL',
      minimumFractionDigits: 2,
    }),
    KES: new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }),
    NGN: new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }),
    EGP: new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 2,
    }),
  };

  const formatter = formatters[currency] || formatters.ZAR;
  return formatter.format(amount);
};

export const getCurrencySymbol = (currency: string = 'ZAR'): string => {
  const symbols: Record<string, string> = {
    ZAR: 'R',
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: '$',
    AUD: '$',
    JPY: '¥',
    CHF: 'Fr',
    CNY: '¥',
    INR: '₹',
    BRL: 'R$',
    MXN: '$',
    BWP: 'P',
    NAD: '$',
    ZWL: '$',
    KES: 'KSh',
    NGN: '₦',
    EGP: 'E£',
  };
  
  return symbols[currency] || 'R';
};

export const getSouthAfricanBanks = () => [
  'ABSA Bank',
  'Standard Bank',
  'First National Bank (FNB)',
  'Nedbank',
  'Capitec Bank',
  'Discovery Bank',
  'African Bank',
  'Bidvest Bank',
  'Investec Bank',
  'Tyme Bank',
];

export const getSouthAfricanProvinces = () => [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];
