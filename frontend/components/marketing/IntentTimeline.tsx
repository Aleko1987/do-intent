import { Badge } from "@/components/ui/badge";
import type { IntentEvent } from "~backend/marketing/types";
import { Activity } from "lucide-react";

interface IntentTimelineProps {
  events: IntentEvent[];
}

export default function IntentTimeline({ events }: IntentTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No events recorded yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, index) => {
          const metadata = event.metadata as Record<string, unknown>;
          const platform = typeof metadata.platform === "string" ? metadata.platform : null;
          const actionType = typeof metadata.action_type === "string" ? metadata.action_type : null;
          const actorDisplay = typeof metadata.actor_display === "string" ? metadata.actor_display : null;
          const actorRef = typeof metadata.actor_ref === "string" ? metadata.actor_ref : null;
          const inboxTaskId = typeof metadata.inbox_task_id === "string" ? metadata.inbox_task_id : null;
          const executionAttemptId = typeof metadata.execution_attempt_id === "string" ? metadata.execution_attempt_id : null;
          return (
        <div key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            {index < events.length - 1 && (
              <div className="flex-1 w-px bg-border my-1" />
            )}
          </div>

          <div className="flex-1 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">
                  {event.event_type.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.occurred_at).toLocaleString()}
                </p>
              </div>
              <Badge variant={event.event_value > 10 ? "default" : "secondary"}>
                +{event.event_value}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Source: {event.event_source}
            </p>
            {(platform || actionType || actorDisplay || actorRef || inboxTaskId || executionAttemptId) && (
              <p className="text-xs text-muted-foreground mt-1">
                {platform ? `Platform: ${platform}` : "Platform: n/a"}
                {actionType ? ` · Action: ${actionType}` : ""}
                {(actorDisplay || actorRef) ? ` · Actor: ${actorDisplay ?? actorRef}` : ""}
                {inboxTaskId ? ` · Task: ${inboxTaskId}` : ""}
                {executionAttemptId ? ` · Execution: ${executionAttemptId}` : ""}
              </p>
            )}
          </div>
        </div>
          );
      })}
    </div>
  );
}
