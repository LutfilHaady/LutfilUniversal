"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { getPresets, reconcilePreset } from "@/lib/api";
import type { ReconciliationResult, PresetOption } from "@/lib/types";

interface PresetSelectorProps {
  onResult: (result: ReconciliationResult) => void;
  onError: (error: string) => void;
}

export function PresetSelector({ onResult, onError }: PresetSelectorProps) {
  const [presets, setPresets] = useState<PresetOption[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [presetsLoading, setPresetsLoading] = useState(true);

  useEffect(() => {
    async function fetchPresets() {
      try {
        const data = await getPresets();
        setPresets(data);
      } catch (err) {
        onError(
          err instanceof Error
            ? err.message
            : "Failed to load presets."
        );
      } finally {
        setPresetsLoading(false);
      }
    }
    fetchPresets();
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedPreset) {
      onError("Please select a preset pair.");
      return;
    }

    setLoading(true);
    try {
      const result = await reconcilePreset(selectedPreset);
      onResult(result);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedPresetData = presets.find((p) => p.id === selectedPreset);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preset Pairs</CardTitle>
        <CardDescription>
          Select a pre-configured invoice/PO pair from the sample dataset.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">
              Select Preset
            </label>
            {presetsLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading presets...
              </p>
            ) : presets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No presets available. Ensure the backend is running.
              </p>
            ) : (
              <Select
                value={selectedPreset}
                onValueChange={(value) => setSelectedPreset(value as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a preset pair..." />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedPresetData && (
              <p className="text-xs text-muted-foreground">
                {selectedPresetData.description}
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
            disabled={loading || !selectedPreset}
            className="w-full"
          >
            {loading ? "Reconciling..." : "Reconcile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
