import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MarketingLead } from "~backend/marketing/types";
import { Mail, Phone, Trash2 } from "lucide-react";

interface LeadCardProps {
  lead: MarketingLead;
  onClick: () => void;
  onDelete?: (leadId: string) => void;
}

export default function LeadCard({ lead, onClick, onDelete }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const title =
    lead.display_name ||
    lead.contact_name ||
    lead.company ||
    lead.company_name ||
    lead.email ||
    lead.anonymous_id ||
    lead.id ||
    "Unknown";

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? "opacity-50" : ""
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-foreground truncate">
              {title}
            </h4>
            {lead.contact_name && (
              <p className="text-xs text-muted-foreground truncate">{lead.contact_name}</p>
            )}
          </div>
          <div className="ml-2 flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {lead.intent_score}
            </Badge>
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Delete lead"
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(lead.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-1">
          {lead.email && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span className="truncate">{lead.phone}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs">
          <Badge variant="outline" className="text-xs">
            {lead.source_type}
          </Badge>
          {lead.last_signal_at && (
            <span className="text-muted-foreground">
              {new Date(lead.last_signal_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
