import { useEffect, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { MarketingLead } from "~backend/marketing/types";
import PipelineColumn from "./PipelineColumn";
import LeadCard from "./LeadCard";
import LeadDetailModal from "./LeadDetailModal";
import { useToast } from "@/components/ui/use-toast";
import { useBackend } from "@/lib/useBackend";
import { useAuth } from "@clerk/clerk-react";

const STAGES = [
  { id: "M1", name: "Seen" },
  { id: "M2", name: "Engaged" },
  { id: "M3", name: "Educated" },
  { id: "M4", name: "Trust" },
  { id: "M5", name: "Intent" },
];

export default function MarketingPipeline() {
  const [leads, setLeads] = useState<MarketingLead[]>([]);
  const [selectedLead, setSelectedLead] = useState<MarketingLead | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const backend = useBackend();
  const { isLoaded, isSignedIn } = useAuth();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    // Only load leads AFTER Clerk is fully loaded
    if (!isLoaded) return;
    if (!isSignedIn) return;

    loadLeads();
  }, [isLoaded, isSignedIn]);

  const loadLeads = async () => {
    try {
      const response = await backend.marketing.list({});
      setLeads(response.leads);
    } catch (error) {
      console.error("Failed to load leads:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load marketing leads",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const leadId = active.id as string;
    const dropTargetId = over.id as string;
    const newStage = STAGES.some((stage) => stage.id === dropTargetId)
      ? dropTargetId
      : leads.find((lead) => lead.id === dropTargetId)?.marketing_stage;

    if (!newStage) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Unable to determine target stage",
      });
      return;
    }

    try {
      await backend.marketing.update({ id: leadId, marketing_stage: newStage });
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId ? { ...lead, marketing_stage: newStage } : lead
        )
      );
      toast({
        title: "Stage updated",
        description: `Lead moved to ${STAGES.find((s) => s.id === newStage)?.name}`,
      });
    } catch (error) {
      console.error("Failed to update stage:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update lead stage",
      });
    }
  };

  const getLeadsByStage = (stageId: string) => {
    return leads.filter((lead) => lead.marketing_stage === stageId);
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading pipeline...</div>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-5 gap-4">
          {STAGES.map((stage) => (
            <PipelineColumn
              key={stage.id}
              stage={stage}
              leads={getLeadsByStage(stage.id)}
              onLeadClick={setSelectedLead}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead ? (
            <div className="rotate-3 opacity-80">
              <LeadCard lead={activeLead} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={loadLeads}
        />
      )}
    </>
  );
}
