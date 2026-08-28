"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { Discrepancy } from "@/lib/types";

interface DiscrepancyTableProps {
  discrepancies: Discrepancy[];
}

function severityBadgeClass(severity: string): string {
  switch (severity.toLowerCase()) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
    case "material":
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800";
    case "minor":
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
    case "cosmetic":
    case "low":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800";
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function DiscrepancyTable({ discrepancies }: DiscrepancyTableProps) {
  if (discrepancies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-green-700 dark:text-green-400">
            No Discrepancies Found
          </CardTitle>
          <CardDescription>
            The invoice and purchase order are fully aligned.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Discrepancies ({discrepancies.length} found)
        </CardTitle>
        <CardDescription>
          Differences detected between the invoice and purchase order.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Severity</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Line Item</TableHead>
              <TableHead>Invoice Value</TableHead>
              <TableHead>PO Value</TableHead>
              <TableHead className="text-right">Financial Impact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {discrepancies.map((d, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={severityBadgeClass(d.severity)}
                  >
                    {d.severity}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{d.type}</TableCell>
                <TableCell>{d.line_item ?? "--"}</TableCell>
                <TableCell>{d.invoice_value}</TableCell>
                <TableCell>{d.po_value}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(d.financial_impact)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
