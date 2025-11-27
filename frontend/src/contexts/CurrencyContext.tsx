import React, {
  createContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";

interface CurrencyContextType {
  currency: string;
  setCurrency: (currency: string) => void;
  formatCurrency: (amount: number) => string;
  getCurrencySymbol: (currency: string) => string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
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
  TND: "د.ت",
  TRY: "₺",
  ZAR: "R",
  AED: "د.إ",
  SAR: "﷼",
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined
);

interface CurrencyProviderProps {
  children: ReactNode;
}

const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [currency, setCurrencyState] = useState("USD");

  // Initialize currency from user settings or localStorage fallback
  useEffect(() => {
    if (user?.settings?.currency) {
      setCurrencyState(user.settings.currency);
    } else {
      const savedCurrency = localStorage.getItem("preferred_currency");
      if (savedCurrency) {
        setCurrencyState(savedCurrency);
      }
    }
  }, [user?.settings?.currency]);

  const setCurrency = (newCurrency: string) => {
    setCurrencyState(newCurrency);
    localStorage.setItem("preferred_currency", newCurrency);
  };

  const formatCurrency = (amount: number): string => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
      }).format(amount);
    } catch {
      return `${getCurrencySymbol(currency)}${amount.toFixed(2)}`;
    }
  };

  const getCurrencySymbol = (curr: string): string => {
    return CURRENCY_SYMBOLS[curr] || curr;
  };

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, formatCurrency, getCurrencySymbol }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export { CurrencyProvider, CurrencyContext };
