import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Flint brand palette (print-friendly: light background, dark ink, green accent)
const GREEN  = [34, 197, 94]   as [number, number, number]
const DARK   = [15, 23, 42]    as [number, number, number]
const MID    = [71, 85, 105]   as [number, number, number]
const LIGHT  = [248, 250, 252] as [number, number, number]
const WHITE  = [255, 255, 255] as [number, number, number]
const STRIPE = [241, 245, 249] as [number, number, number]

type Tab = 'Batch Summary' | 'QC Analysis' | 'Defect Trends' | 'Compliance'

interface PdfPayload {
  tab: Tab
  dateFrom: string
  dateTo: string
  batchRows: any[]
  qcRows: any[]
  defectRows: { name: string; count: number }[]
  compliance: {
    total: number; passCount: number; failCount: number;
    overrideCount: number; passRate: number
  } | null
}

function drawHeader(doc: jsPDF, tab: Tab, dateFrom: string, dateTo: string) {
  const pageW = doc.internal.pageSize.getWidth()

  // Green accent bar across the top
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, pageW, 4, 'F')

  // Header background
  doc.setFillColor(...DARK)
  doc.rect(0, 4, pageW, 28, 'F')

  // Wordmark
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...WHITE)
  doc.text('FLINT', 14, 17)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GREEN)
  doc.text('TRACEABILITY', 32, 17)

  // Report title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...WHITE)
  doc.text(`${tab} Report`, 14, 26)

  // Date range — right-aligned
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MID)
  const dateLabel = `${dateFrom}  –  ${dateTo}`
  doc.text(dateLabel, pageW - 14, 17, { align: 'right' })

  // Generated timestamp
  const ts = new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore', hour12: false })
  doc.text(`Generated ${ts}`, pageW - 14, 26, { align: 'right' })
}

function drawFooter(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.4)
  doc.line(14, pageH - 14, pageW - 14, pageH - 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MID)
  doc.text('Flint Labs · Singapore · Confidential', 14, pageH - 8)
  doc.text(`Page ${(doc as any).internal.getCurrentPageInfo().pageNumber}`, pageW - 14, pageH - 8, { align: 'right' })
}

function tableStyles() {
  return {
    headStyles: {
      fillColor: DARK,
      textColor: WHITE,
      fontStyle: 'bold' as const,
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8, textColor: DARK },
    alternateRowStyles: { fillColor: STRIPE },
    styles: { cellPadding: 3, lineColor: LIGHT, lineWidth: 0.2 },
    margin: { left: 14, right: 14 },
    startY: 42,
  }
}

export function exportPdf(payload: PdfPayload): void {
  const { tab, dateFrom, dateTo, batchRows, qcRows, defectRows, compliance } = payload
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  drawHeader(doc, tab, dateFrom, dateTo)

  const opts = tableStyles()

  if (tab === 'Batch Summary') {
    autoTable(doc, {
      ...opts,
      head: [['Batch ID', 'Material', 'Qty', 'Unit', 'Status', 'Created']],
      body: batchRows.map(r => [
        r.batch_number ?? '—',
        (r.materials as any)?.name ?? '—',
        r.current_quantity != null ? String(r.current_quantity) : '—',
        r.unit ?? '—',
        r.status ?? '—',
        r.created_at ? r.created_at.slice(0, 10) : '—',
      ]),
      columnStyles: {
        0: { cellWidth: 40, font: 'courier' },
        4: { cellWidth: 24 },
        5: { cellWidth: 24 },
      },
    })
  }

  if (tab === 'QC Analysis') {
    autoTable(doc, {
      ...opts,
      head: [['QC Check', 'Criteria', 'Verdict', 'Checked By', 'Date']],
      body: qcRows.map(r => [
        (r.qc_check_definitions as any)?.qc_item_name ?? '—',
        (r.qc_check_definitions as any)?.acceptance_criteria_text ?? '—',
        r.passed ? 'Pass' : 'Fail',
        (r.users as any)?.full_name ?? '—',
        r.created_at ? r.created_at.slice(0, 10) : '—',
      ]),
      bodyStyles: { fontSize: 7.5, textColor: DARK },
      didDrawCell: (data) => {
        // Colour-code the Verdict column
        if (data.section === 'body' && data.column.index === 2) {
          const pass = data.cell.text[0] === 'Pass'
          doc.setTextColor(...(pass ? GREEN : ([220, 38, 38] as [number, number, number])))
          doc.setFont('helvetica', 'bold')
          doc.text(data.cell.text[0], data.cell.x + data.cell.padding('left'), data.cell.y + data.cell.height / 2 + 1.5)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(...DARK)
          return false
        }
      },
    })
  }

  if (tab === 'Defect Trends') {
    const totalDefects = defectRows.reduce((s, r) => s + r.count, 0)
    autoTable(doc, {
      ...opts,
      head: [['Defect / QC Item', 'Occurrences', '% of Total']],
      body: defectRows.map(r => [
        r.name,
        String(r.count),
        totalDefects ? `${((r.count / totalDefects) * 100).toFixed(1)}%` : '—',
      ]),
      columnStyles: {
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
      },
    })
  }

  if (tab === 'Compliance') {
    if (compliance) {
      // Summary KPI block
      const kpis = [
        ['Total Checks', String(compliance.total)],
        ['Passed', String(compliance.passCount)],
        ['Failed', String(compliance.failCount)],
        ['Overrides', String(compliance.overrideCount)],
        ['Pass Rate', `${compliance.passRate}%`],
        ['Date Range', `${dateFrom} – ${dateTo}`],
      ]
      autoTable(doc, {
        ...opts,
        head: [['Metric', 'Value']],
        body: kpis,
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold' },
          1: { cellWidth: 50 },
        },
        tableWidth: 100,
      })
    } else {
      doc.setFontSize(10)
      doc.setTextColor(...MID)
      doc.text('No compliance data for the selected date range.', 14, 50)
    }
  }

  drawFooter(doc)

  const fileName = `flint-${tab.toLowerCase().replace(/ /g, '-')}-${dateFrom}-to-${dateTo}.pdf`
  doc.save(fileName)
}
