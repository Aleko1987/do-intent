import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MarketingLead } from "~backend/marketing/types";
import { Building2, Mail, Phone, TrendingUp } from "lucide-react";

interface LeadCardProps {
  lead: MarketingLead;
  onClick: () => void;
}

export default function LeadCard({ lead, onClick }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const leadWithFallbackFields = lead as MarketingLead & {
    company?: string | null;
    anonymous_id?: string | null;
  };
  const title =
    lead.display_name ??
    lead.contact_name ??
    leadWithFallbackFields.company ??
    lead.company_name ??
    lead.email ??
    leadWithFallbackFields.anonymous_id ??
    lead.id;

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
          <Badge variant="secondary" className="ml-2 text-xs">
            {lead.intent_score}
          </Badge>
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
