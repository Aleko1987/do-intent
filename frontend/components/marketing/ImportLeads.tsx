import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Upload, FileText, CheckCircle } from "lucide-react";
import { useBackend } from "@/lib/useBackend";

export default function ImportLeads() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(0);
  const { toast } = useToast();
  const backend = useBackend();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setImported(0);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n");
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

      let count = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(",").map((v) => v.trim());
        const row: Record<string, string> = {};

        headers.forEach((header, idx) => {
          row[header] = values[idx] || "";
        });

        try {
          await backend.marketing.create({
            company_name: row.company || row.company_name || "",
            contact_name: row.contact || row.contact_name || row.name || "",
            email: row.email || "",
            phone: row.phone || row.phone_number || "",
            source_type: row.source || "apollo",
            apollo_lead_id: row.apollo_id || row.lead_id || undefined,
          });
          count++;
        } catch (error) {
          console.error("Failed to import row:", error);
        }
      }

      setImported(count);
      toast({
        title: "Import complete",
        description: `Successfully imported ${count} leads`,
      });
    } catch (error) {
      console.error("Import failed:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to import leads",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Import Leads from CSV</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Upload a CSV file with columns: company, contact_name, email, phone, source
        </p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="csv-file">CSV File</Label>
            <div className="mt-2">
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={importing}
              />
            </div>
          </div>

          {file && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{file.name}</span>
            </div>
          )}

          {imported > 0 && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 rounded-lg">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Imported {imported} leads successfully</span>
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={!file || importing}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {importing ? "Importing..." : "Import Leads"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
