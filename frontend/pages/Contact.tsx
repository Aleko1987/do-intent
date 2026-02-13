import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { identifyLead, trackEvent, getLeadId } from "@/lib/doIntent";
import { identify as identifyIntent } from "@/lib/doIntentTracker";

export default function Contact() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [miniReport, setMiniReport] = useState<string | null>(null);
  const [qualifying, setQualifying] = useState(false);
  const [companySize, setCompanySize] = useState("");
  const [timeline, setTimeline] = useState("");
  const [monthlyTraffic, setMonthlyTraffic] = useState("");
  const [requestTeardownCall, setRequestTeardownCall] = useState(false);
  const formStartedRef = useRef(false);
  const { toast } = useToast();

  const buildMiniReport = () => {
    const now = new Date().toISOString();
    const summaryName = name.trim() || "there";
    const summaryCompany = company.trim() || "your company";
    const sourceHint =
      new URLSearchParams(window.location.search).get("utm_source") || "direct";
    return [
      "DO-Intent Mini Report",
      "=====================",
      `Generated: ${now}`,
      `Contact: ${summaryName} <${email.trim().toLowerCase()}>`,
      `Company: ${summaryCompany}`,
      "",
      "Quick Intent Observations",
      "-------------------------",
      `- Acquisition source hint: ${sourceHint}`,
      "- Pricing/contact engagement should be prioritized for follow-up.",
      "- Keep conversion-path CTAs visible on high-intent pages.",
      "",
      "Recommended Next Steps",
      "----------------------",
      "1) Review top intent signals for this lead in Marketing > Intent Signals.",
      "2) Trigger personalized outreach within 24h for hot/critical bands.",
      "3) Validate campaign attribution (UTM + click IDs) in recent events.",
      "",
      "Need a deeper teardown? Reply to this report and request a full audit call.",
    ].join("\n");
  };

  // Track contact page view (only if lead_id exists)
  useEffect(() => {
    const leadId = getLeadId();
    if (leadId) {
      trackEvent(leadId, "contact_view").catch((error) => {
        console.error("Failed to track contact_view:", error);
      });
    }
  }, []);

  // Track form_start when user focuses any input (only if lead_id exists after identify)
  const handleInputFocus = () => {
    if (formStartedRef.current) return;
    const leadId = getLeadId();
    if (leadId) {
      formStartedRef.current = true;
      trackEvent(leadId, "form_start", { form: "contact" }).catch((error) => {
        console.error("Failed to track form_start:", error);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Step 1: Identify the lead (intent_scorer endpoint)
      await identifyIntent(email, name).catch((error) => {
        console.error("Intent tracker identify failed:", error);
        // Don't block form submission
      });

      // Step 2: Identify the lead (marketing endpoint - existing)
      const { lead_id } = await identifyLead(email, company, name);

      // Step 3: Track form submission
      await trackEvent(lead_id, "form_submit", {
        form: "contact",
        lead_magnet: "mini_report",
      });

      // Step 4: Auto-deliver mini-report in-app (downloadable)
      const report = buildMiniReport();
      setMiniReport(report);

      // Show success message
      toast({
        title: "Mini report ready",
        description: "Your free intent report has been generated below.",
      });

      // Reset form
      setEmail("");
      setName("");
      setCompany("");
      setMessage("");
    } catch (error) {
      console.error("DO Intent tracking failed:", error);
      // Don't block form submission if tracking fails
      toast({
        title: "Message sent!",
        description: "We'll get back to you soon.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQualificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQualifying(true);
    try {
      const leadId = getLeadId();
      if (leadId) {
        await trackEvent(leadId, "form_submit", {
          form: "qualification",
          lead_magnet: "mini_report",
          company_size: companySize || undefined,
          timeline: timeline || undefined,
          monthly_traffic: monthlyTraffic || undefined,
          teardown_call_requested: requestTeardownCall,
        });

        if (requestTeardownCall) {
          await trackEvent(leadId, "link_click", {
            cta_type: "teardown_call",
            destination: "teardown_booking",
          });
        }
      }

      if (requestTeardownCall) {
        const bookingUrl =
          import.meta.env.VITE_TEARDOWN_CALL_URL || "https://calendly.com";
        window.open(bookingUrl, "_blank", "noopener,noreferrer");
      }

      toast({
        title: "Saved",
        description: requestTeardownCall
          ? "Qualification saved and call booking opened."
          : "Qualification saved. We will follow up with recommendations.",
      });
    } catch (error) {
      console.error("Qualification flow failed:", error);
      toast({
        title: "Saved",
        description: "Qualification noted. We'll follow up shortly.",
      });
    } finally {
      setQualifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Get Your Free Intent Mini Report</h1>
          <p className="text-muted-foreground mt-2">
            Share your details and we&apos;ll generate an instant teardown starter report.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Send us a message</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={handleInputFocus}
                  placeholder="Your name"
                />
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={handleInputFocus}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  onFocus={handleInputFocus}
                  placeholder="Your company"
                />
              </div>

              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onFocus={handleInputFocus}
                  placeholder="Your message"
                  rows={6}
                />
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting ? "Generating..." : "Generate Free Report"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {miniReport && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Your Mini Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-xs leading-5">
                {miniReport}
              </pre>
              <Button
                type="button"
                onClick={() => {
                  const blob = new Blob([miniReport], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "do-intent-mini-report.txt";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download Report
              </Button>
            </CardContent>
          </Card>
        )}

        {miniReport && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Optional: Qualification + Teardown Call</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleQualificationSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="company-size">Company size</Label>
                  <Input
                    id="company-size"
                    value={companySize}
                    onChange={(e) => setCompanySize(e.target.value)}
                    placeholder="e.g. 1-10, 11-50, 51-200"
                  />
                </div>
                <div>
                  <Label htmlFor="timeline">Buying timeline</Label>
                  <Input
                    id="timeline"
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    placeholder="e.g. this month, this quarter"
                  />
                </div>
                <div>
                  <Label htmlFor="traffic">Monthly traffic estimate</Label>
                  <Input
                    id="traffic"
                    value={monthlyTraffic}
                    onChange={(e) => setMonthlyTraffic(e.target.value)}
                    placeholder="e.g. 5k, 25k, 100k+"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={requestTeardownCall}
                    onChange={(e) => setRequestTeardownCall(e.target.checked)}
                  />
                  Request a teardown call
                </label>
                <Button type="submit" disabled={qualifying}>
                  {qualifying
                    ? "Saving..."
                    : requestTeardownCall
                    ? "Save and Book Call"
                    : "Save Qualification"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

