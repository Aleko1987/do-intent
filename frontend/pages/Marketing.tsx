import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MarketingPipeline from "@/components/marketing/MarketingPipeline";
import ContentPlan from "@/components/marketing/ContentPlan";
import IntentSignals from "@/components/marketing/IntentSignals";
import ImportLeads from "@/components/marketing/ImportLeads";
import ScoringModel from "@/components/marketing/ScoringModel";

export default function Marketing() {
  const [activeTab, setActiveTab] = useState("pipeline");

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[1800px] mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Marketing</h1>
          <p className="text-muted-foreground mt-1">
            Manage leads, intent signals, and content campaigns
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-[800px] grid-cols-5">
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="content">Content Plan</TabsTrigger>
            <TabsTrigger value="signals">Intent Signals</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="scoring">Scoring Model</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="mt-6">
            <MarketingPipeline />
          </TabsContent>

          <TabsContent value="content" className="mt-6">
            <ContentPlan />
          </TabsContent>

          <TabsContent value="signals" className="mt-6">
            <IntentSignals />
          </TabsContent>

          <TabsContent value="import" className="mt-6">
            <ImportLeads />
          </TabsContent>

          <TabsContent value="scoring" className="mt-6">
            <ScoringModel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
