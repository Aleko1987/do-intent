import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EventsTab from "@/components/intent/EventsTab";
import ScoresTab from "@/components/intent/ScoresTab";
import RulesTab from "@/components/intent/RulesTab";
import LeadsTab from "@/components/intent/LeadsTab";

export default function IntentScorer() {
  const [activeTab, setActiveTab] = useState("leads");

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Intent Scorer</h1>
          <p className="text-muted-foreground mt-2">
            Deterministic event scoring engine with configurable rules
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="scores">Scores</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="mt-6">
            <LeadsTab />
          </TabsContent>

          <TabsContent value="events" className="mt-6">
            <EventsTab />
          </TabsContent>

          <TabsContent value="scores" className="mt-6">
            <ScoresTab />
          </TabsContent>

          <TabsContent value="rules" className="mt-6">
            <RulesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
