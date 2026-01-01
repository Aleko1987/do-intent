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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import type { ContentItem } from "~backend/content/types";
import { useBackend } from "@/lib/useBackend";

interface ContentItemFormProps {
  item: ContentItem | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ContentItemForm({ item, open, onClose, onSaved }: ContentItemFormProps) {
  const [formData, setFormData] = useState({
    title: "",
    body: "",
    target_url: "",
    utm_source: "",
    utm_medium: "social",
    utm_campaign: "",
    utm_content: "",
    scheduled_at: "",
    channels: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const backend = useBackend();

  useEffect(() => {
    if (item) {
      setFormData({
        title: item.title,
        body: item.body || "",
        target_url: item.target_url || "",
        utm_source: item.utm_source || "",
        utm_medium: item.utm_medium || "social",
        utm_campaign: item.utm_campaign || "",
        utm_content: item.utm_content || "",
        scheduled_at: item.scheduled_at
          ? new Date(item.scheduled_at).toISOString().slice(0, 16)
          : "",
        channels: item.channels || [],
      });
    } else {
      setFormData({
        title: "",
        body: "",
        target_url: "",
        utm_source: "",
        utm_medium: "social",
        utm_campaign: "",
        utm_content: "",
        scheduled_at: "",
        channels: [],
      });
    }
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (item) {
        await backend.content.update({
          id: item.id,
          ...formData,
          scheduled_at: formData.scheduled_at || undefined,
        });
      } else {
        await backend.content.create({
          ...formData,
          scheduled_at: formData.scheduled_at || undefined,
        });
      }

      toast({ title: item ? "Content updated" : "Content created" });
      onSaved();
    } catch (error) {
      console.error("Failed to save content:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save content item",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Content" : "New Content"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <Label>Body</Label>
            <Textarea
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              rows={4}
            />
          </div>

          <div>
            <Label>Target URL</Label>
            <Input
              type="url"
              value={formData.target_url}
              onChange={(e) => setFormData({ ...formData, target_url: e.target.value })}
              placeholder="https://example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>UTM Source</Label>
              <Input
                value={formData.utm_source}
                onChange={(e) => setFormData({ ...formData, utm_source: e.target.value })}
                placeholder="linkedin"
              />
            </div>
            <div>
              <Label>UTM Medium</Label>
              <Input
                value={formData.utm_medium}
                onChange={(e) => setFormData({ ...formData, utm_medium: e.target.value })}
                placeholder="social"
              />
            </div>
            <div>
              <Label>UTM Campaign</Label>
              <Input
                value={formData.utm_campaign}
                onChange={(e) => setFormData({ ...formData, utm_campaign: e.target.value })}
                placeholder="q1-launch"
              />
            </div>
            <div>
              <Label>UTM Content</Label>
              <Input
                value={formData.utm_content}
                onChange={(e) => setFormData({ ...formData, utm_content: e.target.value })}
                placeholder="post-variant-a"
              />
            </div>
          </div>

          <div>
            <Label>Schedule For</Label>
            <Input
              type="datetime-local"
              value={formData.scheduled_at}
              onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
