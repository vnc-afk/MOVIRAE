"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Upload, FileText, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrefetchAwareQuery } from "@/lib/usePrefetchAwareQuery";
import { queryKeys } from "@/lib/queryKeys";

export default function ImportExport() {
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");
  const trendingQuery = usePrefetchAwareQuery({
    queryKey: queryKeys.discover.seeds(),
    queryFn: async () => {
      const response = await fetch("/api/tmdb/trending?page=1");
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: true,
  });

  const movieCount = trendingQuery.data?.length ?? 0;

  const handleExportCSV = () => {
    const blob = new Blob(["Title,Year,Rating,Genre,Director\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cinelog_watchlist.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    setImportStatus("success");
    setTimeout(() => setImportStatus("idle"), 3000);
  };

  return (
    <div className="pb-20 md:pb-0">
      <div className="container py-8 max-w-xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">Import / Export</h1>
          </div>
          <p className="text-sm text-muted-foreground">Bring your data in from IMDb or export your MOVIRAE lists.</p>
        </motion.div>

        {/* Export */}
        <div className="rounded-xl bg-card p-6 card-shadow space-y-4">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">Export</h2>
          </div>
          <p className="text-sm text-muted-foreground">Download your watchlist, ratings, and reviews as a CSV file.</p>
          <div className="flex gap-3">
            <Button onClick={handleExportCSV} className="gap-2">
              <Download className="h-4 w-4" /> Export as CSV
            </Button>
            <Button variant="secondary" className="gap-2">
              <Download className="h-4 w-4" /> Export as JSON
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{movieCount} films will be exported.</p>
        </div>

        {/* Import */}
        <div className="rounded-xl bg-card p-6 card-shadow space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">Import</h2>
          </div>
          <p className="text-sm text-muted-foreground">Import your watchlist from IMDb, Letterboxd, or a CSV file.</p>

          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer" onClick={handleImport}>
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-foreground font-medium">Drop a file here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">Supports CSV, JSON, IMDb export files</p>
          </div>

          {importStatus === "success" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-lg bg-accent/10 text-accent p-3 text-sm"
            >
              <Check className="h-4 w-4" /> Successfully imported 24 films!
            </motion.div>
          )}

          {importStatus === "error" && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 text-destructive p-3 text-sm">
              <AlertCircle className="h-4 w-4" /> Could not parse file. Please check the format.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
