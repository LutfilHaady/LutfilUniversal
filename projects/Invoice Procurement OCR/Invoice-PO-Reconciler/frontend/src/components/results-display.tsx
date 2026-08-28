"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DiscrepancyTable } from "@/components/discrepancy-table";
import { OcrComparisonCard } from "@/components/ocr-comparison";
import type { ReconciliationResult, LineItem } from "@/lib/types";

interface ResultsDisplayProps {
  result: ReconciliationResult;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function LineItemsTable({ items }: { items: LineItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No line items.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Unit Price</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => (
          <TableRow key={index}>
            <TableCell>{item.description}</TableCell>
            <TableCell className="text-right">{item.quantity}</TableCell>
            <TableCell className="text-right font-mono">
              {formatCurrency(item.unit_price)}
            </TableCell>
            <TableCell className="text-right font-mono">
              {formatCurrency(item.total)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ResultsDisplay({ result }: ResultsDisplayProps) {
  const { invoice, purchase_order, discrepancies, ocr_comparison } = result;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">
        Reconciliation Results
      </h2>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Invoice Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Invoice</span>
              <Badge variant="secondary">{invoice.ocr_source}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Invoice Number</p>
                <p className="font-medium">{invoice.invoice_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{invoice.date}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Vendor</p>
                <p className="font-medium">{invoice.vendor_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">PO Reference</p>
                <p className="font-medium">
                  {invoice.po_reference ?? "--"}
                </p>
              </div>
            </div>

            <LineItemsTable items={invoice.line_items} />

            <div className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">
                  {formatCurrency(invoice.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-mono">
                  {formatCurrency(invoice.tax)}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="font-mono">
                  {formatCurrency(invoice.total)}
                </span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              OCR Confidence: {(invoice.ocr_confidence * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        {/* PO Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">PO Number</p>
                <p className="font-medium">{purchase_order.po_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{purchase_order.date}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Vendor</p>
                <p className="font-medium">{purchase_order.vendor_name}</p>
              </div>
            </div>

            <LineItemsTable items={purchase_order.line_items} />

            <div className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">
                  {formatCurrency(purchase_order.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-mono">
                  {formatCurrency(purchase_order.tax)}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="font-mono">
                  {formatCurrency(purchase_order.total)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discrepancies */}
      <DiscrepancyTable discrepancies={discrepancies} />

      {/* OCR Comparison */}
      {ocr_comparison && <OcrComparisonCard comparison={ocr_comparison} />}
    </div>
  );
}
