import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const PaymentMethodsContext = createContext({ stripe: true, qonto: false, mollie: false, klarna: false, alma: false });

export const PaymentMethodsProvider = ({ children }) => {
  const [methods, setMethods] = useState({ stripe: true, qonto: false, mollie: false, klarna: false, alma: false });

  useEffect(() => {
    api.get("/payment-methods").then(r => setMethods(r.data)).catch(() => {});
  }, []);

  return <PaymentMethodsContext.Provider value={methods}>{children}</PaymentMethodsContext.Provider>;
};

export const usePaymentMethods = () => useContext(PaymentMethodsContext);
