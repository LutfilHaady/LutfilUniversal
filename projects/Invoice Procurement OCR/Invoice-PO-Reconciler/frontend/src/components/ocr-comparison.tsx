"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OcrComparison } from "@/lib/types";

interface OcrComparisonCardProps {
  comparison: OcrComparison;
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.9)
    return "text-green-700 dark:text-green-400";
  if (confidence >= 0.7)
    return "text-yellow-700 dark:text-yellow-400";
  return "text-red-700 dark:text-red-400";
}

function confidencePercent(confidence: number): string {
  return `${(confidence * 100).toFixed(1)}%`;
}

export function OcrComparisonCard({ comparison }: OcrComparisonCardProps) {
  const agreementEntries = Object.entries(comparison.field_agreement);
  const agreedCount = agreementEntries.filter(([, agreed]) => agreed).length;
  const totalCount = agreementEntries.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>OCR Engine Comparison</CardTitle>
        <CardDescription>
          Confidence scores and field agreement between Tesseract and PaddleOCR.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Tesseract
            </p>
            <p
              className={`text-2xl font-bold ${confidenceColor(comparison.tesseract_confidence)}`}
            >
              {confidencePercent(comparison.tesseract_confidence)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              PaddleOCR
            </p>
            <p
              className={`text-2xl font-bold ${confidenceColor(comparison.paddleocr_confidence)}`}
            >
              {confidencePercent(comparison.paddleocr_confidence)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Field Agreement</p>
            <p className="text-sm text-muted-foreground">
              {agreedCount}/{totalCount} fields
            </p>
          </div>
          <div className="space-y-2">
            {agreementEntries.map(([field, agreed]) => (
              <div
                key={field}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground capitalize">
                  {field.replace(/_/g, " ")}
                </span>
                <Badge
                  variant={agreed ? "secondary" : "destructive"}
                >
                  {agreed ? "Match" : "Mismatch"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
