const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

const COLUMNS = [
  { header: "Visitor Name", key: "visitorName", width: 22 },
  { header: "Phone", key: "phone", width: 16 },
  { header: "Email", key: "email", width: 24 },
  { header: "Purpose", key: "purpose", width: 22 },
  { header: "Employee Visited", key: "employeeName", width: 20 },
  { header: "Department", key: "department", width: 16 },
  { header: "Visit Date", key: "visitDateStr", width: 14 },
  { header: "Arrival Time", key: "expectedArrivalTime", width: 12 },
  { header: "Status", key: "status", width: 14 },
  { header: "Check-In", key: "checkInStr", width: 18 },
  { header: "Check-Out", key: "checkOutStr", width: 18 },
];

// Flattens a populated Visit mongoose document into plain row data.
function toRow(visit) {
  return {
    visitorName: visit.visitorName,
    phone: visit.phone,
    email: visit.email || "-",
    purpose: visit.purpose,
    employeeName: visit.employee?.name || "-",
    department: visit.employee?.department || "-",
    visitDateStr: visit.visitDate ? new Date(visit.visitDate).toLocaleDateString() : "-",
    expectedArrivalTime: visit.expectedArrivalTime || "-",
    status: (visit.status || "").replaceAll("_", " "),
    checkInStr: visit.checkInTime ? new Date(visit.checkInTime).toLocaleString() : "-",
    checkOutStr: visit.checkOutTime ? new Date(visit.checkOutTime).toLocaleString() : "-",
  };
}

// Builds an .xlsx workbook buffer from an array of Visit documents.
async function buildVisitsExcel(visits, title = "Visitor Report") {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Visitor Pass Management System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Visitors");
  sheet.columns = COLUMNS;

  sheet.mergeCells("A1:K1");
  sheet.getCell("A1").value = title;
  sheet.getCell("A1").font = { size: 14, bold: true };
  sheet.insertRow(2, []); // spacer row

  const headerRowIndex = 3;
  const headerRow = sheet.getRow(headerRowIndex);
  COLUMNS.forEach((col, idx) => {
    headerRow.getCell(idx + 1).value = col.header;
  });
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F766E" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  visits.forEach((visit) => {
    const row = toRow(visit);
    sheet.addRow(COLUMNS.map((col) => row[col.key]));
  });

  sheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: COLUMNS.length },
  };

  return workbook.xlsx.writeBuffer();
}

// Builds a PDF buffer from an array of Visit documents. Returns a Promise
// that resolves with the finished PDF as a Buffer.
function buildVisitsPDF(visits, title = "Visitor Report", statistics = null) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(18).fillColor("#0f766e").text(title, { align: "left" });
      doc.moveDown(0.3);
      doc
        .fontSize(9)
        .fillColor("#666666")
        .text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown(0.8);

      if (statistics) {
        doc.fontSize(10).fillColor("#000000");
        const summaryLine = [
          `Total: ${statistics.totalVisitors}`,
          `Pending: ${statistics.pending}`,
          `Approved: ${statistics.approved}`,
          `Rejected: ${statistics.rejected}`,
          `Checked In: ${statistics.checkedIn}`,
          `Checked Out: ${statistics.checkedOut}`,
          `Cancelled: ${statistics.cancelled}`,
        ].join("   |   ");
        doc.text(summaryLine);
        doc.moveDown(0.8);
      }

      const headers = [
        "Visitor",
        "Phone",
        "Purpose",
        "Employee",
        "Visit Date",
        "Time",
        "Status",
      ];
      const colWidths = [110, 80, 130, 110, 75, 55, 80];
      const startX = doc.page.margins.left;
      let y = doc.y;

      const drawHeaderRow = () => {
        let x = startX;
        doc.fontSize(9).fillColor("#ffffff");
        headers.forEach((text, i) => {
          doc.rect(x, y, colWidths[i], 20).fill("#0f766e");
          doc.fillColor("#ffffff").text(text, x + 4, y + 6, {
            width: colWidths[i] - 8,
            ellipsis: true,
          });
          x += colWidths[i];
        });
        y += 20;
      };

      drawHeaderRow();

      visits.forEach((visit, idx) => {
        const row = toRow(visit);
        const values = [
          row.visitorName,
          row.phone,
          row.purpose,
          row.employeeName,
          row.visitDateStr,
          row.expectedArrivalTime,
          row.status,
        ];

        if (y > doc.page.height - doc.page.margins.bottom - 30) {
          doc.addPage();
          y = doc.page.margins.top;
          drawHeaderRow();
        }

        let x = startX;
        const bg = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
        doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), 18).fill(bg);
        doc.fillColor("#111111").fontSize(8);
        values.forEach((text, i) => {
          doc.text(String(text ?? "-"), x + 4, y + 5, {
            width: colWidths[i] - 8,
            ellipsis: true,
          });
          x += colWidths[i];
        });
        y += 18;
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildVisitsExcel, buildVisitsPDF };
