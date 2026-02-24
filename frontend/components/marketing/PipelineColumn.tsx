import { useDroppable } from "@dnd-kit/core";
import type { MarketingLead } from "~backend/marketing/types";
import LeadCard from "./LeadCard";

interface PipelineColumnProps {
  stage: { id: string; name: string };
  leads: MarketingLead[];
  onLeadClick: (lead: MarketingLead) => void;
  onLeadDelete: (leadId: string) => void;
}

export default function PipelineColumn({
  stage,
  leads,
  onLeadClick,
  onLeadDelete,
}: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  return (
    <div className="flex flex-col min-h-[600px]">
      <div className="bg-muted/50 rounded-lg p-3 mb-3">
        <h3 className="font-semibold text-sm text-foreground">{stage.name}</h3>
        <p className="text-xs text-muted-foreground mt-1">{leads.length} leads</p>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 bg-muted/20 rounded-lg p-2 space-y-2 transition-colors ${
          isOver ? "bg-muted/40 ring-2 ring-primary" : ""
        }`}
      >
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onClick={() => onLeadClick(lead)}
            onDelete={onLeadDelete}
          />
        ))}

        {leads.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No leads
          </div>
        )}
      </div>
    </div>
  );
}
