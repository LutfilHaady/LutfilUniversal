"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { UploadForm } from "@/components/upload-form";
import { PresetSelector } from "@/components/preset-selector";
import { ResultsDisplay } from "@/components/results-display";
import type { ReconciliationResult } from "@/lib/types";

export default function Home() {
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleResult(data: ReconciliationResult) {
    setError(null);
    setResult(data);
  }

  function handleError(message: string) {
    setError(message);
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Invoice-PO Reconciler
          </h1>
          <p className="text-muted-foreground">
            Upload an invoice image and purchase order to detect discrepancies
            using dual OCR engines and AI-powered analysis.
          </p>
        </div>

        {/* Input Section */}
        <Tabs defaultValue="upload" className="mb-8">
          <TabsList>
            <TabsTrigger value="upload">Upload Files</TabsTrigger>
            <TabsTrigger value="presets">Preset Pairs</TabsTrigger>
          </TabsList>
          <TabsContent value="upload">
            <UploadForm onResult={handleResult} onError={handleError} />
          </TabsContent>
          <TabsContent value="presets">
            <PresetSelector onResult={handleResult} onError={handleError} />
          </TabsContent>
        </Tabs>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mb-8">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results Display */}
        {result && <ResultsDisplay result={result} />}
      </div>
    </main>
  );
}
