import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeadId, trackEvent } from "@/lib/doIntent";

// Mock case studies data - replace with your actual data source
const CASE_STUDIES: Record<string, { title: string; slug: string }> = {
  "acme-corp": {
    title: "How Acme Corp Increased Revenue by 300%",
    slug: "acme-corp",
  },
  "tech-startup": {
    title: "Tech Startup's Journey to Success",
    slug: "tech-startup",
  },
  "enterprise-solution": {
    title: "Enterprise Solution Case Study",
    slug: "enterprise-solution",
  },
};

export default function CaseStudy() {
  const { slug } = useParams<{ slug: string }>();
  const caseStudy = slug ? CASE_STUDIES[slug] : null;

  // Track case study view (only if lead_id exists)
  useEffect(() => {
    const leadId = getLeadId();
    if (leadId && caseStudy) {
      trackEvent(leadId, "case_study_view", {
        slug: caseStudy.slug,
        title: caseStudy.title,
      }).catch((error) => {
        console.error("Failed to track case_study_view:", error);
      });
    }
  }, [caseStudy]);

  if (!caseStudy) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-foreground">Case Study Not Found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">{caseStudy.title}</h1>
          <p className="text-muted-foreground mt-2">
            Case Study: {caseStudy.slug}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This is a case study page. Replace this content with your actual case study content.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

