import { Github, Upload, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/dashboard/primitives";

type ScanMode = "github" | "local";

export function ScanControls({
  scanMode, setScanMode,
  repoUrl, setRepoUrl,
  selectedFile, setSelectedFile,
  onRun, scanning, error, scanTime,
  exampleRepos = [],
  runLabel,
}: {
  scanMode: ScanMode;
  setScanMode: (m: ScanMode) => void;
  repoUrl: string;
  setRepoUrl: (v: string) => void;
  selectedFile: File | null;
  setSelectedFile: (f: File | null) => void;
  onRun: () => void;
  scanning: boolean;
  error: string | null;
  scanTime: number | null;
  exampleRepos?: string[];
  runLabel: string;
}) {
  return (
    <Panel className="mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-border">
          {(["github", "local"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setScanMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                scanMode === mode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              {mode === "github" ? <Github className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
              {mode === "github" ? "GitHub URL" : "Upload Local"}
            </button>
          ))}
        </div>

        {scanMode === "github" ? (
          <Input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="min-w-0 flex-1 font-mono text-xs"
          />
        ) : (
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/40">
            <Upload className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{selectedFile ? selectedFile.name : "Choose a .zip file of your project…"}</span>
            <input
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}

        <Button variant="hero" size="sm" onClick={onRun} disabled={scanning}>
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {scanning ? "Scanning…" : runLabel}
        </Button>
      </div>

      {scanMode === "github" && exampleRepos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {exampleRepos.map((url) => (
            <button
              key={url}
              onClick={() => setRepoUrl(url)}
              className="rounded-md border border-border bg-secondary/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
            >
              {url.replace("https://github.com/", "")}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-xs text-critical">
          {error}
        </div>
      )}

      {scanTime !== null && !error && (
        <div className="mt-3 text-xs text-muted-foreground">Scan completed in {scanTime}s</div>
      )}
    </Panel>
  );
}
