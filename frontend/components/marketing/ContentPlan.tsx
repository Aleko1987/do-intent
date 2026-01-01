import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import type { ContentItem } from "~backend/content/types";
import ContentItemForm from "./ContentItemForm";
import { Calendar, Plus, ExternalLink, Copy } from "lucide-react";
import { useBackend } from "@/lib/useBackend";

export default function ContentPlan() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const backend = useBackend();

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const response = await backend.content.list();
      setItems(response.items);
    } catch (error) {
      console.error("Failed to load content:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load content items",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateTrackingUrl = (item: ContentItem) => {
    if (!item.target_url) return "";
    const url = new URL(item.target_url);
    if (item.utm_source) url.searchParams.set("utm_source", item.utm_source);
    if (item.utm_medium) url.searchParams.set("utm_medium", item.utm_medium);
    if (item.utm_campaign) url.searchParams.set("utm_campaign", item.utm_campaign);
    if (item.utm_content) url.searchParams.set("utm_content", item.utm_content);
    return url.toString();
  };

  const copyTrackingUrl = (item: ContentItem) => {
    const url = generateTrackingUrl(item);
    navigator.clipboard.writeText(url);
    toast({ title: "Copied to clipboard" });
  };

  const handleEdit = (item: ContentItem) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingItem(null);
  };

  const handleSaved = () => {
    loadItems();
    handleCloseForm();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading content...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Content Calendar</h2>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Content
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-sm flex-1">{item.title}</h3>
              <Badge variant={item.status === "posted" ? "default" : "secondary"}>
                {item.status}
              </Badge>
            </div>

            {item.body && (
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                {item.body}
              </p>
            )}

            <div className="space-y-2">
              {item.scheduled_at && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(item.scheduled_at).toLocaleString()}
                </div>
              )}

              {item.channels.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {item.channels.map((channel) => (
                    <Badge key={channel} variant="outline" className="text-xs">
                      {channel}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
                  Edit
                </Button>
                {item.target_url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyTrackingUrl(item)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {showForm && (
        <ContentItemForm
          item={editingItem}
          open={showForm}
          onClose={handleCloseForm}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
