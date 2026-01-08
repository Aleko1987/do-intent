import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { identifyLead, trackEvent, getLeadId } from "@/lib/doIntent";

export default function Contact() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const formStartedRef = useRef(false);
  const { toast } = useToast();

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
      // Step 1: Identify the lead
      const { lead_id } = await identifyLead(email, company, name);

      // Step 2: Track form submission
      await trackEvent(lead_id, "form_submit", {
        form: "contact",
      });

      // Show success message
      toast({
        title: "Message sent!",
        description: "We'll get back to you soon.",
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Contact Us</h1>
          <p className="text-muted-foreground mt-2">
            Get in touch with our team
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
                {submitting ? "Sending..." : "Send Message"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

