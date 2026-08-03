import React from "react";
import { SiKlarna } from "react-icons/si";
import { usePaymentMethods } from "@/context/PaymentMethodsContext";

const MIN_INSTALLMENT_ELIGIBLE_AMOUNT = 300;

export default function KlarnaBadge({ price, size = "sm" }) {
  const { klarna, alma } = usePaymentMethods();
  const numericPrice = Number(price);

  if (!Number.isFinite(numericPrice) || numericPrice < MIN_INSTALLMENT_ELIGIBLE_AMOUNT) return null;

  const enabledProviders = [];
  if (klarna) enabledProviders.push("Klarna");
  if (alma) enabledProviders.push("Alma");

  if (enabledProviders.length === 0) return null;

  const installment = (numericPrice / 3).toFixed(2);
  const isLarge = size === "lg";
  const providerLabel = enabledProviders.length > 1 ? "Klarna ou Alma" : enabledProviders[0];

  return (
    <div
      className={`inline-flex items-center gap-1.5 border border-border text-muted-foreground ${
        isLarge ? "px-3 py-2 text-sm" : "px-2 py-1 text-xs"
      }`}
      data-testid="klarna-badge"
    >
      <span>ou 3x {installment} € avec</span>
      {providerLabel === "Klarna" ? (
        <SiKlarna className={isLarge ? "w-5 h-5" : "w-4 h-4"} style={{ color: "#FFB3C7" }} />
      ) : (
        <span className="font-semibold text-foreground">{providerLabel}</span>
      )}
    </div>
  );
}
