import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import type { MarketingLead, IntentEvent } from "~backend/marketing/types";
import IntentTimeline from "./IntentTimeline";
import { ArrowRight, TrendingUp } from "lucide-react";
import { useBackend } from "@/lib/useBackend";

interface LeadDetailModalProps {
  lead: MarketingLead;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const EVENT_TYPES = [
  "web_visit",
  "web_pricing_view",
  "manual_call",
  "manual_note",
  "apollo_open",
  "apollo_click",
  "form_submit",
];

export default function LeadDetailModal({ lead, open, onClose, onUpdate }: LeadDetailModalProps) {
  const [events, setEvents] = useState<IntentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [editedLead, setEditedLead] = useState(lead);
  const [newEventType, setNewEventType] = useState("");
  const { toast } = useToast();
  const backend = useBackend();

  useEffect(() => {
    if (open) {
      loadEvents();
      setEditedLead(lead);
    }
  }, [open, lead]);

  const loadEvents = async () => {
    try {
      const response = await backend.marketing.getWithEvents({ id: lead.id });
      setEvents(response.recent_events);
    } catch (error) {
      console.error("Failed to load events:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await backend.marketing.update({
        id: editedLead.id,
        company_name: editedLead.company_name || undefined,
        contact_name: editedLead.contact_name || undefined,
        email: editedLead.email || undefined,
        phone: editedLead.phone || undefined,
        auto_push_enabled: editedLead.auto_push_enabled,
      });
      toast({ title: "Lead updated" });
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Failed to update lead:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update lead",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogEvent = async () => {
    if (!newEventType) return;

    setLoading(true);
    try {
      await backend.marketing.createEvent({
        id: lead.id,
        event_type: newEventType,
        event_source: "manual",
      });
      toast({ title: "Event logged" });
      loadEvents();
      setNewEventType("");
      onUpdate();
    } catch (error) {
      console.error("Failed to log event:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to log event",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{lead.company_name || "Lead Details"}</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                <TrendingUp className="h-3 w-3 mr-1" />
                {lead.intent_score}
              </Badge>
              <Badge>{lead.marketing_stage}</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Company Name</Label>
                <Input
                  value={editedLead.company_name || ""}
                  onChange={(e) => setEditedLead({ ...editedLead, company_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Contact Name</Label>
                <Input
                  value={editedLead.contact_name || ""}
                  onChange={(e) => setEditedLead({ ...editedLead, contact_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editedLead.email || ""}
                  onChange={(e) => setEditedLead({ ...editedLead, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={editedLead.phone || ""}
                  onChange={(e) => setEditedLead({ ...editedLead, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <input
                type="checkbox"
                id="auto-push"
                checked={editedLead.auto_push_enabled}
                onChange={(e) =>
                  setEditedLead({ ...editedLead, auto_push_enabled: e.target.checked })
                }
                className="h-4 w-4"
              />
              <Label htmlFor="auto-push" className="cursor-pointer">
                Auto-push to sales when ready (M5 or score ≥31)
              </Label>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={loading}>
                Save Changes
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Select value={newEventType} onValueChange={setNewEventType}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleLogEvent} disabled={!newEventType || loading}>
                Log Event
              </Button>
            </div>

            <IntentTimeline events={events} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
