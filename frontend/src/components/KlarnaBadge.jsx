import React from "react";
import { SiKlarna } from "react-icons/si";
import { usePaymentMethods } from "@/context/PaymentMethodsContext";

export default function KlarnaBadge({ price, size = "sm" }) {
  const { klarna } = usePaymentMethods();
  if (!klarna || !price) return null;

  const installment = (price / 3).toFixed(2);
  const isLarge = size === "lg";

  return (
    <div
      className={`inline-flex items-center gap-1.5 border border-border text-muted-foreground ${
        isLarge ? "px-3 py-2 text-sm" : "px-2 py-1 text-xs"
      }`}
      data-testid="klarna-badge"
    >
      <span>ou 3x {installment} € avec</span>
      <SiKlarna className={isLarge ? "w-5 h-5" : "w-4 h-4"} style={{ color: "#FFB3C7" }} />
    </div>
  );
}
