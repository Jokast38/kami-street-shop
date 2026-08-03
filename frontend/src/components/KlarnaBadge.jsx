import React from "react";
import { SiKlarna } from "react-icons/si";
import { usePaymentMethods } from "@/context/PaymentMethodsContext";

const MIN_INSTALLMENT_ELIGIBLE_AMOUNT = 300;
const DEFAULT_INSTALLMENTS = 12;

export default function KlarnaBadge({ price, size = "sm" }) {
  const { klarna, alma } = usePaymentMethods();
  const numericPrice = Number(price);

  if (!Number.isFinite(numericPrice) || numericPrice < MIN_INSTALLMENT_ELIGIBLE_AMOUNT) return null;

  if (!klarna && !alma) return null;

  const installment = (numericPrice / DEFAULT_INSTALLMENTS).toFixed(2);
  const isLarge = size === "lg";
  const showAlma = Boolean(alma);

  return (
    <div
      className={`inline-flex items-center gap-1.5 border border-border text-muted-foreground ${
        isLarge ? "px-3 py-2 text-sm" : "px-2 py-1 text-xs"
      }`}
      data-testid="klarna-badge"
    >
      <span>ou {DEFAULT_INSTALLMENTS}x {installment} € avec</span>
      {showAlma ? (
        <span className={`font-semibold text-foreground ${isLarge ? "text-sm" : "text-xs"}`}>Alma</span>
      ) : (
        <SiKlarna className={isLarge ? "w-5 h-5" : "w-4 h-4"} style={{ color: "#FFB3C7" }} />
      )}
    </div>
  );
}
