import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MarketingPipeline from "@/components/marketing/MarketingPipeline";
import ContentPlan from "@/components/marketing/ContentPlan";
import IntentSignals from "@/components/marketing/IntentSignals";
import ImportLeads from "@/components/marketing/ImportLeads";
import ScoringModel from "@/components/marketing/ScoringModel";
import CandidateSignalReviewQueue from "@/components/marketing/CandidateSignalReviewQueue";
import UnifiedInbox from "@/components/marketing/UnifiedInbox";
import LeadDirectory from "@/components/marketing/LeadDirectory";
import OwnerContactDirectory from "@/components/marketing/OwnerContactDirectory";

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
          <TabsList className="grid w-full max-w-[1600px] grid-cols-9">
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="leads">Lead Directory</TabsTrigger>
            <TabsTrigger value="contacts">Contact Directory</TabsTrigger>
            <TabsTrigger value="content">Content Plan</TabsTrigger>
            <TabsTrigger value="signals">Intent Signals</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="scoring">Scoring Model</TabsTrigger>
            <TabsTrigger value="review">Review Queue</TabsTrigger>
            <TabsTrigger value="inbox">Unified Inbox</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="mt-6">
            <MarketingPipeline />
          </TabsContent>

          <TabsContent value="leads" className="mt-6">
            <LeadDirectory />
          </TabsContent>

          <TabsContent value="contacts" className="mt-6">
            <OwnerContactDirectory />
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

          <TabsContent value="review" className="mt-6">
            <CandidateSignalReviewQueue />
          </TabsContent>

          <TabsContent value="inbox" className="mt-6">
            <UnifiedInbox />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
