"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { reconcileUpload } from "@/lib/api";
import type { ReconciliationResult } from "@/lib/types";

interface UploadFormProps {
  onResult: (result: ReconciliationResult) => void;
  onError: (error: string) => void;
}

export function UploadForm({ onResult, onError }: UploadFormProps) {
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [poFile, setPoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const poInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!invoiceFile || !poFile) {
      onError("Please select both an invoice image and a PO JSON file.");
      return;
    }

    setLoading(true);
    try {
      const result = await reconcileUpload(invoiceFile, poFile);
      onResult(result);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Files</CardTitle>
        <CardDescription>
          Upload an invoice image and its corresponding PO JSON file for
          reconciliation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="invoice-upload"
              className="text-sm font-medium leading-none"
            >
              Invoice Image
            </label>
            <Input
              id="invoice-upload"
              ref={invoiceInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
              disabled={loading}
            />
            {invoiceFile && (
              <p className="text-xs text-muted-foreground">
                Selected: {invoiceFile.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="po-upload"
              className="text-sm font-medium leading-none"
            >
              PO JSON File
            </label>
            <Input
              id="po-upload"
              ref={poInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => setPoFile(e.target.files?.[0] ?? null)}
              disabled={loading}
            />
            {poFile && (
              <p className="text-xs text-muted-foreground">
                Selected: {poFile.name}
              </p>
            )}
          </div>

          {loading && (
            <Alert>
              <AlertTitle>Processing</AlertTitle>
              <AlertDescription>
                Running OCR and reconciliation. This may take a moment...
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={loading || !invoiceFile || !poFile}
            className="w-full"
          >
            {loading ? "Reconciling..." : "Reconcile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
