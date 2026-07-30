"""PDF invoice generation, styled after the Kami Street brand (logo, black/lime accent)."""
from io import BytesIO
from pathlib import Path
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, HRFlowable,
)

ASSETS_DIR = Path(__file__).parent / "assets"
LOGO_PATH = ASSETS_DIR / "logo-kami-street-black.png"

ACCENT = colors.HexColor("#DAFF33")
INK = colors.HexColor("#0B0B0C")
GRAY = colors.HexColor("#6B6B70")
LIGHT_GRAY = colors.HexColor("#F4F4F5")

COMPANY = {
    "name": "Kami Street",
    "address_line": "59 Av. Joffre, 93800 Épinay-sur-Seine, France",
    "phone": "+33 1 80 90 72 51",
    "site": "kamistreet.fr",
}

styles = getSampleStyleSheet()
STYLE_H1 = ParagraphStyle("InvoiceH1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=22, textColor=INK, spaceAfter=0)
STYLE_SMALL = ParagraphStyle("InvoiceSmall", parent=styles["Normal"], fontName="Helvetica", fontSize=9, textColor=GRAY, leading=13)
STYLE_SMALL_RIGHT = ParagraphStyle("InvoiceSmallRight", parent=STYLE_SMALL, alignment=TA_RIGHT)
STYLE_BODY = ParagraphStyle("InvoiceBody", parent=styles["Normal"], fontName="Helvetica", fontSize=10, textColor=INK, leading=14)
STYLE_LABEL = ParagraphStyle("InvoiceLabel", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, textColor=GRAY, leading=11)


def _money(value: float) -> str:
    return f"{value:,.2f} €".replace(",", " ").replace(".", ",")


def generate_invoice_pdf(invoice: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=18 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm,
        title=f"Facture {invoice.get('invoice_no', '')}",
    )
    flow = []

    # ---- Header: logo + FACTURE title ----
    header_cells = [["", ""]]
    if LOGO_PATH.exists():
        logo = Image(str(LOGO_PATH), width=42 * mm, height=42 * mm * 0.28)
        logo.hAlign = "LEFT"
    else:
        logo = Paragraph(COMPANY["name"], STYLE_H1)
    title = Paragraph("FACTURE", STYLE_H1)
    header_tbl = Table([[logo, title]], colWidths=[100 * mm, 72 * mm])
    header_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    flow.append(header_tbl)
    flow.append(Spacer(1, 4 * mm))
    flow.append(HRFlowable(width="100%", thickness=2, color=ACCENT))
    flow.append(Spacer(1, 6 * mm))

    # ---- Company / Invoice meta / Billing address ----
    company_block = Paragraph(
        f"<b>{COMPANY['name']}</b><br/>{COMPANY['address_line']}<br/>{COMPANY['phone']}<br/>{COMPANY['site']}",
        STYLE_BODY,
    )
    created_at = invoice.get("created_at", "")
    try:
        date_txt = datetime.fromisoformat(created_at.replace("Z", "+00:00")).strftime("%d/%m/%Y")
    except Exception:
        date_txt = created_at[:10] if created_at else datetime.now().strftime("%d/%m/%Y")

    meta_block = Paragraph(
        f"<b>N° facture :</b> {invoice.get('invoice_no', '')}<br/>"
        f"<b>Date :</b> {date_txt}<br/>"
        + (f"<b>Commande :</b> {invoice.get('order_no')}<br/>" if invoice.get("order_no") else ""),
        STYLE_SMALL_RIGHT,
    )
    billing = invoice.get("billing_address") or {}
    billing_block = Paragraph(
        "<b>FACTURÉ À</b><br/>"
        f"{invoice.get('customer_name', '')}<br/>"
        f"{invoice.get('customer_email', '')}<br/>"
        f"{billing.get('line1', '')}<br/>"
        f"{billing.get('postal_code', '')} {billing.get('city', '')}<br/>"
        f"{billing.get('country', '')}",
        STYLE_BODY,
    )

    meta_tbl = Table([[company_block, meta_block]], colWidths=[86 * mm, 86 * mm])
    meta_tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    flow.append(meta_tbl)
    flow.append(Spacer(1, 6 * mm))
    flow.append(billing_block)
    flow.append(Spacer(1, 8 * mm))

    # ---- Line items table ----
    items = invoice.get("items", [])
    tax_rate = float(invoice.get("tax_rate", 0) or 0)
    subtotal = sum(float(i.get("unit_price", 0)) * int(i.get("quantity", 1)) for i in items)
    tax_amount = subtotal * tax_rate / 100
    total = subtotal + tax_amount

    header_row = ["Description", "Qté", "Prix unitaire", "Total"]
    rows = [header_row]
    for it in items:
        qty = int(it.get("quantity", 1))
        unit_price = float(it.get("unit_price", 0))
        rows.append([
            Paragraph(it.get("name", ""), STYLE_BODY),
            str(qty),
            _money(unit_price),
            _money(unit_price * qty),
        ])

    items_tbl = Table(rows, colWidths=[92 * mm, 18 * mm, 30 * mm, 32 * mm], repeatRows=1)
    tbl_style = [
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), ACCENT),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, 0), 0, ACCENT),
    ]
    for i in range(1, len(rows)):
        if i % 2 == 0:
            tbl_style.append(("BACKGROUND", (0, i), (-1, i), LIGHT_GRAY))
    items_tbl.setStyle(TableStyle(tbl_style))
    flow.append(items_tbl)
    flow.append(Spacer(1, 6 * mm))

    # ---- Totals ----
    totals_rows = [["Sous-total", _money(subtotal)]]
    if tax_rate:
        totals_rows.append([f"TVA ({tax_rate:g}%)", _money(tax_amount)])
    totals_rows.append(["TOTAL TTC", _money(total)])

    totals_tbl = Table(totals_rows, colWidths=[40 * mm, 32 * mm], hAlign="RIGHT")
    totals_style = [
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (-1, -2), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 12),
        ("LINEABOVE", (0, -1), (-1, -1), 1.2, INK),
        ("TOPPADDING", (0, -1), (-1, -1), 8),
        ("BACKGROUND", (0, -1), (-1, -1), LIGHT_GRAY),
    ]
    totals_tbl.setStyle(TableStyle(totals_style))
    flow.append(totals_tbl)

    notes = invoice.get("notes")
    if notes:
        flow.append(Spacer(1, 8 * mm))
        flow.append(Paragraph(f"<b>Notes :</b> {notes}", STYLE_SMALL))

    flow.append(Spacer(1, 14 * mm))
    flow.append(HRFlowable(width="100%", thickness=0.75, color=colors.HexColor("#E4E4E7")))
    flow.append(Spacer(1, 3 * mm))
    flow.append(Paragraph(
        f"{COMPANY['name']} · {COMPANY['address_line']} · {COMPANY['site']}",
        STYLE_SMALL,
    ))

    doc.build(flow)
    return buf.getvalue()
