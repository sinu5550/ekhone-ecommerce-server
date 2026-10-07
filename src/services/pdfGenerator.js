// services/pdfGenerator.js
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const LOCAL_LOGO_PATH = path.join(__dirname, "../../public/ekhone.png");
const FALLBACK_LOGO_URL =
  "https://res.cloudinary.com/dddwxyeod/image/upload/v1791266680/kxqzfzinzbnhecdcqxiq.png";

/**
 * Fetch a remote image and return a Buffer.
 * Resolves to null on any error so the caller can fall back gracefully.
 * @param {string} url
 * @returns {Promise<Buffer|null>}
 */
function fetchImageBuffer(url) {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return resolve(null);
        }
        const parts = [];
        res.on("data", (c) => parts.push(c));
        res.on("end", () => resolve(Buffer.concat(parts)));
        res.on("error", () => resolve(null));
      })
      .on("error", () => resolve(null));
  });
}

function getLocalLogoBuffer() {
  try {
    if (fs.existsSync(LOCAL_LOGO_PATH)) {
      return fs.readFileSync(LOCAL_LOGO_PATH);
    }
  } catch (e) {
    console.error("Error reading local logo:", e);
  }
  return null;
}

class PDFGenerator {
  static async generateOrderReceipt(orderData) {
    const logoBuffer =
      orderData.logoBuffer instanceof Buffer
        ? orderData.logoBuffer
        : getLocalLogoBuffer() || (await fetchImageBuffer(FALLBACK_LOGO_URL));

    return new Promise((resolve, reject) => {
      try {
        // ── Page metrics ──────────────────────────────────────────────
        const PAGE_W = 595.28;
        const PAGE_H = 841.89;
        const MX = 40;
        const CW = PAGE_W - MX * 2;

        const doc = new PDFDocument({
          autoFirstPage: false,
          size: "A4",
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          info: {
            Title: `Ekhone Order #${orderData.orderNumber}`,
            Author: "Ekhone",
            Subject: "Order Receipt",
            Creator: "Ekhone System",
          },
        });

        const chunks = [];
        doc.on("data", (c) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        // ── Colour palette ────────────────────────────────────────────
        const C = {
          brand: "#F45116",
          primary: "#102D50",
          secondary: "#666666",
          tableHead: "#102D50",
          tableHeadTxt: "#FFFFFF",
          summHead: "#102D50",
          rowAlt: "#F5F5F5",
          border: "#DEDEDE",
          success: "#2E7D32",
          warning: "#F45116",
        };

        // ── Helpers ───────────────────────────────────────────────────
        const fmt = (n) =>
          `BDT ${Number(n || 0).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;

        const hline = (
          y,
          x1 = MX,
          x2 = PAGE_W - MX,
          color = C.border,
          lw = 0.5,
        ) =>
          doc
            .strokeColor(color)
            .lineWidth(lw)
            .moveTo(x1, y)
            .lineTo(x2, y)
            .stroke();

        const fillRect = (x, y, w, h, color) =>
          doc.rect(x, y, w, h).fillColor(color).fill();

        const addPage = () =>
          doc.addPage({
            size: "A4",
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
          });

        addPage();

        // ════════════════════════════════════════════════════════════
        // 1. HEADER
        // ════════════════════════════════════════════════════════════
        fillRect(0, 0, PAGE_W, 78, "#FFFFFF");

        // ── Logo (image or text fallback) ──
        if (logoBuffer) {
          doc.image(logoBuffer, MX, 10, { height: 45, fit: [200, 45] });
        } else {
          // Text fallback when logo cannot be fetched
          fillRect(MX, 16, 4, 36, C.brand);
          doc
            .fontSize(24)
            .fillColor(C.primary)
            .font("Helvetica-Bold")
            .text("Ekhone", MX + 10, 18, { lineBreak: false });
          doc
            .circle(MX + 93, 24, 5)
            .fillColor(C.brand)
            .fill();
          doc
            .fontSize(8)
            .fillColor(C.secondary)
            .font("Helvetica")
            .text("E-Commerce Platform", MX + 10, 50, { lineBreak: false });
        }

        // ── Receipt title + meta (right-aligned) ──
        doc
          .fontSize(20)
          .fillColor(C.primary)
          .font("Helvetica-Bold")
          .text("ORDER RECEIPT", 0, 18, {
            width: PAGE_W - MX,
            align: "right",
            lineBreak: false,
          });

        doc
          .fontSize(8.5)
          .fillColor(C.secondary)
          .font("Helvetica")
          .text(`Receipt No: ${orderData.orderNumber || "N/A"}`, 0, 46, {
            width: PAGE_W - MX,
            align: "right",
            lineBreak: false,
          })
          .text(`Date: ${orderData.orderDate || "N/A"}`, 0, 59, {
            width: PAGE_W - MX,
            align: "right",
            lineBreak: false,
          });

        // Yellow band
        fillRect(0, 78, PAGE_W, 12, C.brand);

        // ════════════════════════════════════════════════════════════
        // 2. BILL TO  |  ORDER SUMMARY
        // ════════════════════════════════════════════════════════════
        let cur = 78 + 8 + 16;

        // Left — Bill To
        doc
          .fontSize(9)
          .fillColor(C.primary)
          .font("Helvetica-Bold")
          .text("BILL TO", MX, cur, { lineBreak: false });

        let billY = cur + 16;
        [
          orderData.customerName || "N/A",
          orderData.customerEmail || "N/A",
          orderData.customerPhone || "N/A",
        ].forEach((line) => {
          doc
            .fontSize(9)
            .fillColor(C.primary)
            .font("Helvetica")
            .text(line, MX, billY, { lineBreak: false });
          billY += 14;
        });

        // Right — Order Summary
        const RX = MX + CW / 2 + 12;

        doc
          .fontSize(9)
          .fillColor(C.primary)
          .font("Helvetica-Bold")
          .text("ORDER SUMMARY", RX, cur, { lineBreak: false });

        const sumRows = [
          {
            lbl: "Order Status:",
            val: orderData.status || "Pending",
            vc: C.success,
          },
          {
            lbl: "Payment Method:",
            val: orderData.paymentMethod || "Not specified",
            vc: C.primary,
          },
          {
            lbl: "Payment Status:",
            val: Number(orderData.dueAmount) > 0 ? "COD" : "Paid",
            vc: Number(orderData.dueAmount) > 0 ? C.warning : C.success,
          },
        ];

        let sumY = cur + 16;
        sumRows.forEach((r) => {
          doc
            .fontSize(8.5)
            .fillColor(C.secondary)
            .font("Helvetica")
            .text(r.lbl, RX, sumY, { lineBreak: false });
          doc
            .fontSize(8.5)
            .fillColor(r.vc)
            .font("Helvetica-Bold")
            .text(r.val, 0, sumY, {
              width: PAGE_W - MX,
              align: "right",
              lineBreak: false,
            });
          sumY += 15;
        });

        cur = Math.max(billY, sumY) + 12;
        hline(cur);
        cur += 14;

        // ════════════════════════════════════════════════════════════
        // 3. ITEMS TABLE
        // ════════════════════════════════════════════════════════════
        doc
          .fontSize(10)
          .fillColor(C.primary)
          .font("Helvetica-Bold")
          .text("Order Items", MX, cur, { lineBreak: false });
        cur += 18;

        // MODIFIED: Increased item width by 10px and sku width by 10px
        const TH = {
          item: MX + 2,
          sku: MX + 190,
          qty: MX + 288,
          price: MX + 350,
          total: PAGE_W - MX,
        };
        const ROW_H = 18;
        const HDR_H = 20;

        const drawTableHeader = (y) => {
          fillRect(MX, y, CW, HDR_H, C.tableHead);
          doc
            .fontSize(8)
            .fillColor(C.tableHeadTxt)
            .font("Helvetica-Bold")
            .text("ITEM", TH.item, y + 5, { lineBreak: false })
            .text("SKU", TH.sku, y + 5, { lineBreak: false })
            .text("QTY", TH.qty, y + 5, { lineBreak: false })
            .text("UNIT PRICE", TH.price, y + 5, { lineBreak: false })
            .text("TOTAL", 0, y + 5, {
              width: TH.total,
              align: "right",
              lineBreak: false,
            });
        };

        drawTableHeader(cur);
        cur += HDR_H;

        let subtotal = 0;
        const products = orderData.products || [];

        products.forEach((product, idx) => {
          if (cur + ROW_H > PAGE_H - 70) {
            addPage();
            cur = 40;
            drawTableHeader(cur);
            cur += HDR_H;
          }

          const unit = Number(product.price || 0);
          const qty = Number(product.quantity || 1);
          const total = unit * qty;
          subtotal += total;

          if (idx % 2 === 1) fillRect(MX, cur, CW, ROW_H, C.rowAlt);

          doc
            .fontSize(8.5)
            .fillColor(C.primary)
            .font("Helvetica")
            .text(product.name || "Unknown", TH.item, cur + 4, {
              width: 182,
              ellipsis: true,
              lineBreak: false,
            })
            .text(product.sku || "—", TH.sku, cur + 4, { lineBreak: false })
            .text(String(qty), TH.qty, cur + 4, { lineBreak: false })
            .text(fmt(unit), TH.price, cur + 4, { lineBreak: false })
            .text(fmt(total), 0, cur + 4, {
              width: TH.total,
              align: "right",
              lineBreak: false,
            });

          cur += ROW_H;
        });

        hline(cur, MX, PAGE_W - MX, C.border, 0.75);
        cur += 22;

        // ════════════════════════════════════════════════════════════
        // 4. SHIPPING ADDRESS  |  PRICE SUMMARY  (same baseline)
        // ════════════════════════════════════════════════════════════
        const SEC_TOP = cur;
        const HALF = CW / 2 - 10;

        // ── Right column: Price Summary ──────────────────────────────
        const PS_X = MX + CW / 2 + 10;
        const PS_W = HALF;

        const priceLines = [
          { lbl: "Subtotal:", val: fmt(orderData.subtotal || subtotal) },
          ...(Number(orderData.discount) > 0
            ? [{ lbl: "Discount:", val: `-${fmt(orderData.discount)}` }]
            : []),
          ...(Number(orderData.voucher_promo) > 0
            ? [{ lbl: "Voucher:", val: `-${fmt(orderData.voucher_promo)}` }]
            : []),
          ...(Number(orderData.tax) > 0
            ? [{ lbl: "Tax:", val: fmt(orderData.tax) }]
            : []),
          {
            lbl: "Shipping:",
            val:
              orderData.shippingCost === 0
                ? "Free"
                : fmt(orderData.shippingCost),
          },
        ];

        const hasDue = Number(orderData.dueAmount) > 0;
        const ROWS_H = priceLines.length * 17;
        const TOTAL_H = ROWS_H + 16 + 22 + 17 + (hasDue ? 17 : 0);
        const BOX_H = 20 + 8 + TOTAL_H + 10;

        // Box border
        doc
          .rect(PS_X, SEC_TOP, PS_W, BOX_H)
          .lineWidth(0.75)
          .strokeColor(C.border)
          .stroke();

        // Header strip
        fillRect(PS_X, SEC_TOP, PS_W, 20, C.summHead);
        doc
          .fontSize(8.5)
          .fillColor("#FFFFFF")
          .font("Helvetica-Bold")
          .text("PRICE SUMMARY", PS_X + 8, SEC_TOP + 5, { lineBreak: false });

        let psY = SEC_TOP + 28;

        priceLines.forEach((row) => {
          doc
            .fontSize(8.5)
            .fillColor(C.secondary)
            .font("Helvetica")
            .text(row.lbl, PS_X + 8, psY, { lineBreak: false });
          doc
            .fillColor(C.primary)
            .font("Helvetica")
            .text(row.val, PS_X, psY, {
              width: PS_W - 8,
              align: "right",
              lineBreak: false,
            });
          psY += 17;
        });

        hline(psY + 2, PS_X, PS_X + PS_W, C.border, 0.5);
        psY += 10;

        doc
          .fontSize(10)
          .fillColor(C.primary)
          .font("Helvetica-Bold")
          .text("GRAND TOTAL:", PS_X + 8, psY, { lineBreak: false });
        doc
          .fontSize(11)
          .fillColor(C.primary)
          .font("Helvetica-Bold")
          .text(fmt(orderData.grandTotal || 0), PS_X, psY, {
            width: PS_W - 8,
            align: "right",
            lineBreak: false,
          });
        psY += 22;

        doc
          .fontSize(8.5)
          .fillColor(C.secondary)
          .font("Helvetica")
          .text("Paid:", PS_X + 8, psY, { lineBreak: false });
        doc
          .fillColor(C.success)
          .font("Helvetica-Bold")
          .text(fmt(orderData.paidAmount || 0), PS_X, psY, {
            width: PS_W - 8,
            align: "right",
            lineBreak: false,
          });

        if (hasDue) {
          psY += 17;
          doc
            .fontSize(8.5)
            .fillColor(C.secondary)
            .font("Helvetica")
            .text("Due:", PS_X + 8, psY, { lineBreak: false });
          doc
            .fillColor(C.warning)
            .font("Helvetica-Bold")
            .text(fmt(orderData.dueAmount), PS_X, psY, {
              width: PS_W - 8,
              align: "right",
              lineBreak: false,
            });
        }

        const rightBot = SEC_TOP + BOX_H;

        // ── Left column: Shipping Address ────────────────────────────
        const SA_X = MX;
        const SA_W = HALF;

        doc
          .fontSize(9)
          .fillColor(C.primary)
          .font("Helvetica-Bold")
          .text("SHIPPING ADDRESS", SA_X, SEC_TOP, { lineBreak: false });

        let saY = SEC_TOP + 18;

        if (orderData.shippingAddress) {
          const sa = orderData.shippingAddress;

          fillRect(SA_X, saY, 3, 88, C.brand); // yellow accent strip

          doc
            .fontSize(9)
            .fillColor(C.primary)
            .font("Helvetica-Bold")
            .text(sa.recipientName || "N/A", SA_X + 10, saY + 4, {
              lineBreak: false,
            });
          saY += 18;

          const line1 = sa.address || "";
          const cityUpazila = [sa.upazila, sa.city]
            .filter(Boolean)
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .join(", ");
          const distDiv = [sa.district, sa.division]
            .filter(Boolean)
            .filter(v => v !== sa.city && v !== sa.upazila)
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .join(", ");
          const postal = sa.postalCode ? ` - ${sa.postalCode}` : "";
          const line3 = distDiv || postal ? `${distDiv}${postal}`.trim() : "";

          [
            line1,
            cityUpazila,
            line3,
            sa.country || "Bangladesh",
            `Phone: ${sa.phoneNumber || "N/A"}`,
          ].forEach((line) => {
            if (!line || !line.trim()) return;
            doc
              .fontSize(8.5)
              .fillColor(C.secondary)
              .font("Helvetica")
              .text(line, SA_X + 10, saY, {
                width: SA_W - 14,
                lineBreak: false,
              });
            saY += 13;
          });
        }

        let leftBot = saY;

        if (orderData.note) {
          leftBot += 8;
          doc
            .fontSize(8)
            .fillColor(C.secondary)
            .font("Helvetica-Oblique")
            .text("Note:", SA_X, leftBot, { lineBreak: false });
          leftBot += 12;
          doc
            .fontSize(8)
            .fillColor(C.primary)
            .font("Helvetica")
            .text(orderData.note, SA_X, leftBot, {
              width: SA_W,
              lineBreak: false,
            });
          leftBot += 16;
        }

        cur = Math.max(leftBot, rightBot) + 24;

        // ════════════════════════════════════════════════════════════
        // 5. FOOTER  (pinned to page bottom)
        // ════════════════════════════════════════════════════════════
        const FY = PAGE_H - 44;

        hline(FY, MX, PAGE_W - MX, C.border, 0.5);

        doc
          .fontSize(8)
          .fillColor(C.primary)
          .font("Helvetica-Bold")
          .text("Thank you for your business!", 0, FY + 6, {
            width: PAGE_W,
            align: "center",
            lineBreak: false,
          });

        doc
          .fontSize(7)
          .fillColor(C.secondary)
          .font("Helvetica")
          .text(
            "Dhaka, Bangladesh  |  Phone: +8801969957888  |  Email: info@ekhone.com",
            0,
            FY + 18,
            { width: PAGE_W, align: "center", lineBreak: false },
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // generateInvoice  (same layout as receipt)
  // ─────────────────────────────────────────────────────────────────────────
  static async generateInvoice(orderData) {
    return this.generateOrderReceipt(orderData);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // fetchLogo  — optional pre-fetch helper for caching
  //
  // Pre-fetch once at startup and reuse the Buffer to avoid a network call
  // on every PDF generation:
  //
  //   // server startup
  //   PDFGenerator.logoBuffer = await PDFGenerator.fetchLogo();
  //
  //   // per request
  //   const pdf = await PDFGenerator.generateOrderReceipt({
  //       ...orderData,
  //       logoBuffer: PDFGenerator.logoBuffer,   // skip network call
  //   });
  //
  // If you prefer a local file instead of a URL:
  //   const logoBuffer = require('fs').readFileSync(path.join(__dirname, '../assets/logo.png'));
  //   const pdf = await PDFGenerator.generateOrderReceipt({ ...orderData, logoBuffer });
  // ─────────────────────────────────────────────────────────────────────────
  static async fetchLogo(url = LOGO_URL) {
    const buf = await fetchImageBuffer(url);
    if (!buf) throw new Error(`Could not fetch logo from: ${url}`);
    return buf;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // generateShippingLabel
  // ─────────────────────────────────────────────────────────────────────────
  static async generateShippingLabel(shippingData) {
    const logoBuffer =
      shippingData.logoBuffer instanceof Buffer
        ? shippingData.logoBuffer
        : await fetchImageBuffer(LOGO_URL);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          autoFirstPage: false,
          size: [400, 300],
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });

        const chunks = [];
        doc.on("data", (c) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
        doc.addPage({
          size: [400, 300],
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });

        const C = {
          brand: "#570808",
          primary: "#1A1A1A",
          secondary: "#666666",
          border: "#DEDEDE",
        };

        // Header bar
        doc.rect(0, 0, 400, 38).fillColor(C.brand).fill();

        // Logo or text fallback
        if (logoBuffer) {
          doc.image(logoBuffer, 10, 4, { height: 30, fit: [120, 30] });
        } else {
          doc
            .fontSize(16)
            .fillColor(C.primary)
            .font("Helvetica-Bold")
            .text("Ekhone", 16, 10, { lineBreak: false });
        }

        doc
          .fontSize(7.5)
          .fillColor(C.primary)
          .font("Helvetica")
          .text("E-Commerce Platform", 0, 16, {
            width: 382,
            align: "right",
            lineBreak: false,
          });

        // Ship To
        doc
          .fontSize(9)
          .fillColor(C.primary)
          .font("Helvetica-Bold")
          .text("SHIP TO:", 16, 52, { lineBreak: false });

        if (shippingData.address) {
          const a = shippingData.address;
          let y = 66;
          doc
            .fontSize(8.5)
            .fillColor(C.primary)
            .font("Helvetica-Bold")
            .text(a.name || "", 16, y, { lineBreak: false });
          y += 13;
          doc
            .font("Helvetica")
            .fillColor(C.primary)
            .text(a.street || "", 16, y, { lineBreak: false });
          y += 13;
          doc.text(`${a.city || ""}, ${a.state || ""} ${a.zip || ""}`, 16, y, {
            lineBreak: false,
          });
          y += 13;
          doc.text(a.country || "", 16, y, { lineBreak: false });
        }

        doc
          .fontSize(7.5)
          .fillColor(C.secondary)
          .text(`Order: ${shippingData.orderNumber || "N/A"}`, 16, 160, {
            lineBreak: false,
          });

        // Tracking box
        doc
          .rect(220, 146, 162, 48)
          .lineWidth(0.5)
          .strokeColor(C.border)
          .stroke();
        doc.rect(220, 146, 162, 16).fillColor("#4A4A4A").fill();
        doc
          .fontSize(7)
          .fillColor("#FFFFFF")
          .font("Helvetica-Bold")
          .text("TRACKING NUMBER", 226, 151, { lineBreak: false });
        doc
          .fontSize(8.5)
          .fillColor(C.primary)
          .font("Helvetica")
          .text(shippingData.trackingNumber || "N/A", 226, 169, {
            lineBreak: false,
          });

        // Footer
        doc.rect(0, 266, 400, 34).fillColor(C.brand).fill();
        doc
          .fontSize(6.5)
          .fillColor(C.primary)
          .font("Helvetica")
          .text(
            "Dhaka, Bangladesh | +8801969957888 | info@ekhone.com",
            0,
            278,
            { width: 400, align: "center", lineBreak: false },
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = PDFGenerator;
