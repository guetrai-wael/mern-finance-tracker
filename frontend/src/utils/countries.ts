export interface Country {
  code: string;
  name: string;
  currency: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: "US", name: "United States", currency: "USD", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", currency: "GBP", flag: "🇬🇧" },
  { code: "EU", name: "European Union", currency: "EUR", flag: "🇪🇺" },
  { code: "CA", name: "Canada", currency: "CAD", flag: "🇨🇦" },
  { code: "AU", name: "Australia", currency: "AUD", flag: "🇦🇺" },
  { code: "JP", name: "Japan", currency: "JPY", flag: "🇯🇵" },
  { code: "CH", name: "Switzerland", currency: "CHF", flag: "🇨🇭" },
  { code: "CN", name: "China", currency: "CNY", flag: "🇨🇳" },
  { code: "IN", name: "India", currency: "INR", flag: "🇮🇳" },
  { code: "BR", name: "Brazil", currency: "BRL", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", currency: "MXN", flag: "🇲🇽" },
  { code: "KR", name: "South Korea", currency: "KRW", flag: "🇰🇷" },
  { code: "SG", name: "Singapore", currency: "SGD", flag: "🇸🇬" },
  { code: "NO", name: "Norway", currency: "NOK", flag: "🇳🇴" },
  { code: "SE", name: "Sweden", currency: "SEK", flag: "🇸🇪" },
  { code: "DK", name: "Denmark", currency: "DKK", flag: "🇩🇰" },
  { code: "PL", name: "Poland", currency: "PLN", flag: "🇵🇱" },
  { code: "CZ", name: "Czech Republic", currency: "CZK", flag: "🇨🇿" },
  { code: "HU", name: "Hungary", currency: "HUF", flag: "🇭🇺" },
  { code: "RU", name: "Russia", currency: "RUB", flag: "🇷🇺" },
  { code: "TR", name: "Turkey", currency: "TRY", flag: "🇹🇷" },
  { code: "ZA", name: "South Africa", currency: "ZAR", flag: "🇿🇦" },
  { code: "AE", name: "UAE", currency: "AED", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", flag: "🇸🇦" },
];

export const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CAD: "C$",
    AUD: "A$",
    JPY: "¥",
    CHF: "Fr",
    CNY: "¥",
    INR: "₹",
    BRL: "R$",
    MXN: "$",
    KRW: "₩",
    SGD: "S$",
    NOK: "kr",
    SEK: "kr",
    DKK: "kr",
    PLN: "zł",
    CZK: "Kč",
    HUF: "Ft",
    RUB: "₽",
    TRY: "₺",
    ZAR: "R",
    AED: "د.إ",
    SAR: "﷼",
  };
  return symbols[currency] || currency;
};

export const getCountryByCurrency = (currency: string): Country | undefined => {
  return COUNTRIES.find((country) => country.currency === currency);
};

export const getCurrencyByCountry = (
  countryCode: string
): string | undefined => {
  return COUNTRIES.find((country) => country.code === countryCode)?.currency;
};
