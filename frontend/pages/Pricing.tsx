import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeadId, trackEvent } from "@/lib/doIntent";

export default function Pricing() {
  // Track pricing page view (only if lead_id exists)
  useEffect(() => {
    const leadId = getLeadId();
    if (leadId) {
      trackEvent(leadId, "pricing_view").catch((error) => {
        console.error("Failed to track pricing_view:", error);
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-foreground">Pricing</h1>
          <p className="text-muted-foreground mt-2">
            Choose the plan that's right for you
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Starter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-4">$29/mo</div>
              <ul className="space-y-2">
                <li>Basic features</li>
                <li>Email support</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Professional</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-4">$99/mo</div>
              <ul className="space-y-2">
                <li>All Starter features</li>
                <li>Priority support</li>
                <li>Advanced analytics</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enterprise</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-4">Custom</div>
              <ul className="space-y-2">
                <li>All Professional features</li>
                <li>Dedicated support</li>
                <li>Custom integrations</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

