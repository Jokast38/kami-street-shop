"""PDF invoice generation, matching the Kami Street invoice template (logo, layout, legal totals)."""
from io import BytesIO
from pathlib import Path
from datetime import datetime

from num2words import num2words
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, HRFlowable,
)

ASSETS_DIR = Path(__file__).parent / "assets"
LOGO_PATH = ASSETS_DIR / "logo-kamistreet-VERT.jpg"

ACCENT = colors.HexColor("#DAFF33")
INK = colors.HexColor("#0B0B0C")
GRAY = colors.HexColor("#6B6B70")
LIGHT_GRAY = colors.HexColor("#F4F4F5")
BORDER = colors.HexColor("#D4D4D8")

COMPANY = {
    "name": "KamiStreet",
    "address_line": "59 Av. Joffre, 93800 Épinay-sur-Seine, France",
    "city": "EPINAY SUR SEINE",
    "phone": "+33 1 80 90 72 51",
    "email": "contact@kamistreet.fr",
    "site": "kamistreet.fr",
}

styles = getSampleStyleSheet()
STYLE_H1 = ParagraphStyle("InvoiceH1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=16, textColor=INK, spaceAfter=0)
STYLE_SMALL = ParagraphStyle("InvoiceSmall", parent=styles["Normal"], fontName="Helvetica", fontSize=9, textColor=GRAY, leading=13)
STYLE_SMALL_CENTER = ParagraphStyle("InvoiceSmallCenter", parent=STYLE_SMALL, alignment=TA_CENTER)
STYLE_BODY = ParagraphStyle("InvoiceBody", parent=styles["Normal"], fontName="Helvetica", fontSize=9.5, textColor=INK, leading=13)
STYLE_BODY_BOLD = ParagraphStyle("InvoiceBodyBold", parent=STYLE_BODY, fontName="Helvetica-Bold")
STYLE_CELL_RIGHT = ParagraphStyle("InvoiceCellRight", parent=STYLE_BODY, alignment=TA_RIGHT)
STYLE_LABEL = ParagraphStyle("InvoiceLabel", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, textColor=GRAY, leading=11)
STYLE_AMOUNT_WORDS = ParagraphStyle("InvoiceAmountWords", parent=styles["Normal"], fontName="Helvetica-Oblique", fontSize=9, textColor=INK, alignment=TA_CENTER)


def _money(value: float) -> str:
    return f"{value:,.2f} €".replace(",", " ").replace(".", ",")


def _amount_in_words(total: float) -> str:
    euros = int(total)
    cents = round((total - euros) * 100)
    euros_words = num2words(euros, lang="fr")
    cents_words = num2words(cents, lang="fr")
    euro_label = "euro" if euros == 1 else "euros"
    cent_label = "centime" if cents == 1 else "centimes"
    return f"{euros_words} {euro_label} et {cents_words} {cent_label}".strip().capitalize()


def _bordered_table(rows, col_widths, header_row=False):
    tbl = Table(rows, colWidths=col_widths)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.75, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    if header_row:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), LIGHT_GRAY),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ]
    tbl.setStyle(TableStyle(style))
    return tbl


def generate_invoice_pdf(invoice: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=16 * mm, bottomMargin=16 * mm, leftMargin=18 * mm, rightMargin=18 * mm,
        title=f"Facture {invoice.get('invoice_no', '')}",
    )
    flow = []

    created_at = invoice.get("created_at", "")
    try:
        created_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except Exception:
        created_dt = datetime.now()
    date_txt = created_dt.strftime("%d/%m/%Y")

    # ---- Header: logo (left) + FACTURE meta table (right) ----
    logo_cell = Image(str(LOGO_PATH), width=32 * mm, height=32 * mm) if LOGO_PATH.exists() else Paragraph(COMPANY["name"], STYLE_H1)
    logo_cell.hAlign = "LEFT" if hasattr(logo_cell, "hAlign") else None

    STYLE_META_VALUE = ParagraphStyle("InvoiceMetaValue", parent=STYLE_BODY, fontSize=8.5, alignment=TA_CENTER, leading=10)
    meta_tbl = _bordered_table(
        [
            [Paragraph("FACTURE", STYLE_BODY_BOLD), "", ""],
            [Paragraph("N°", STYLE_LABEL), Paragraph("Date de création", STYLE_LABEL), Paragraph("Lieu de création", STYLE_LABEL)],
            [Paragraph(invoice.get("invoice_no", ""), STYLE_META_VALUE), Paragraph(date_txt, STYLE_META_VALUE), Paragraph(COMPANY["city"], STYLE_META_VALUE)],
        ],
        col_widths=[26 * mm, 28 * mm, 34 * mm],
    )
    meta_tbl.setStyle(TableStyle([
        ("SPAN", (0, 0), (2, 0)),
        ("ALIGN", (0, 0), (2, 0), "CENTER"),
        ("BACKGROUND", (0, 0), (2, 0), LIGHT_GRAY),
        ("BACKGROUND", (0, 1), (2, 1), LIGHT_GRAY),
    ]))

    header_tbl = Table([[logo_cell, meta_tbl]], colWidths=[80 * mm, 88 * mm])
    header_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    flow.append(header_tbl)
    flow.append(Spacer(1, 6 * mm))

    # ---- Customer block (bordered) ----
    billing = invoice.get("billing_address") or {}
    customer_lines = "<br/>".join(filter(None, [
        f"<b>{invoice.get('customer_name', '')}</b>",
        billing.get("line1", ""),
        f"{billing.get('postal_code', '')} {billing.get('city', '')}".strip(),
        billing.get("country", ""),
    ]))
    customer_tbl = _bordered_table([[Paragraph(customer_lines, STYLE_BODY)]], col_widths=[168 * mm])
    flow.append(customer_tbl)
    flow.append(Spacer(1, 8 * mm))

    # ---- Line items table (Réf / Désignation / Qté / PU HT / Total HT) ----
    items = invoice.get("items", [])
    tax_rate = float(invoice.get("tax_rate", 0) or 0)
    # unit_price is stored TTC; derive HT for display without changing the TTC total.
    divisor = 1 + tax_rate / 100.0 if tax_rate else 1.0
    subtotal_ttc = sum(float(i.get("unit_price", 0)) * int(i.get("quantity", 1)) for i in items)
    subtotal_ht = subtotal_ttc / divisor if tax_rate else subtotal_ttc
    tax_amount = subtotal_ttc - subtotal_ht
    total_ttc = subtotal_ttc

    rows = [[
        Paragraph("Réf.", STYLE_LABEL), Paragraph("Désignation", STYLE_LABEL),
        Paragraph("Qté", STYLE_LABEL), Paragraph("PU HT", STYLE_LABEL), Paragraph("Total HT", STYLE_LABEL),
    ]]
    for it in items:
        qty = int(it.get("quantity", 1))
        unit_price_ttc = float(it.get("unit_price", 0))
        unit_price_ht = unit_price_ttc / divisor if tax_rate else unit_price_ttc
        rows.append([
            Paragraph(it.get("ref", "") or "", STYLE_BODY),
            Paragraph(it.get("name", ""), STYLE_BODY),
            Paragraph(str(qty), STYLE_CELL_RIGHT),
            Paragraph(_money(unit_price_ht), STYLE_CELL_RIGHT),
            Paragraph(_money(unit_price_ht * qty), STYLE_CELL_RIGHT),
        ])

    items_tbl = Table(rows, colWidths=[24 * mm, 76 * mm, 14 * mm, 27 * mm, 27 * mm], repeatRows=1)
    items_tbl.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.75, BORDER),
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT_GRAY),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    flow.append(items_tbl)
    flow.append(Spacer(1, 6 * mm))

    # ---- Totals (right-aligned block) ----
    totals_rows = [["Total HT", _money(subtotal_ht)]]
    if tax_rate:
        totals_rows.append([f"Montant TVA ({tax_rate:g}%)", _money(tax_amount)])
    totals_rows.append(["Total TTC", _money(total_ttc)])
    totals_tbl = _bordered_table(totals_rows, col_widths=[45 * mm, 30 * mm])
    totals_tbl.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), LIGHT_GRAY),
    ]))

    # ---- Sale date / Payment method (left) ----
    sale_tbl = _bordered_table(
        [[Paragraph("Date de vente", STYLE_LABEL), Paragraph("Mode de règlement", STYLE_LABEL)],
         [date_txt, invoice.get("payment_method") or "—"]],
        col_widths=[35 * mm, 40 * mm],
    )
    sale_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT_GRAY),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))

    top_row = Table([[sale_tbl, totals_tbl]], colWidths=[80 * mm, 88 * mm])
    top_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    flow.append(top_row)
    flow.append(Spacer(1, 6 * mm))

    notes = invoice.get("notes")
    if notes:
        flow.append(Paragraph("<b>Informations spécifiques :</b>", STYLE_SMALL))
        flow.append(Paragraph(notes, STYLE_SMALL))
        flow.append(Spacer(1, 6 * mm))

    # ---- Amount paid / Amount due ----
    amount_paid = invoice.get("amount_paid")
    amount_paid = total_ttc if amount_paid is None else float(amount_paid)
    amount_due = max(round(total_ttc - amount_paid, 2), 0.0)
    paid_tbl = _bordered_table(
        [["Montant payé", _money(amount_paid)], ["À payer", _money(amount_due)]],
        col_widths=[45 * mm, 30 * mm],
    )
    paid_tbl.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), LIGHT_GRAY if amount_due else colors.HexColor("#E9FBD6")),
    ]))
    paid_row = Table([["", paid_tbl]], colWidths=[80 * mm, 88 * mm])
    paid_row.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    flow.append(paid_row)
    flow.append(Spacer(1, 4 * mm))
    flow.append(Paragraph(_amount_in_words(total_ttc), STYLE_AMOUNT_WORDS))
    flow.append(Spacer(1, 14 * mm))

    flow.append(Paragraph("Nom du vendeur", STYLE_SMALL))

    flow.append(Spacer(1, 14 * mm))
    flow.append(HRFlowable(width="100%", thickness=0.75, color=BORDER))
    flow.append(Spacer(1, 3 * mm))
    flow.append(Paragraph(
        f"{COMPANY['name']} · {COMPANY['address_line']} · {COMPANY['email']} · {COMPANY['site']}",
        STYLE_SMALL,
    ))

    doc.build(flow)
    return buf.getvalue()
