import { api } from "encore.dev/api";
import { db } from "../db/db";
import { recomputeScores } from "./recompute_scores";

interface SeedDemoResponse {
  leads_created: number;
  events_created: number;
}

export const seedDemo = api(
  { method: "POST", path: "/intent-scorer/seed-demo", expose: true },
  async (): Promise<SeedDemoResponse> => {
    const leads = [
      {
        company_name: "Acme Corp",
        contact_name: "Sarah Johnson",
        email: "sarah@acmecorp.com"
      },
      {
        company_name: "TechStart Inc",
        contact_name: "Mike Chen",
        email: "mike@techstart.io"
      },
      {
        company_name: "Global Systems",
        contact_name: "Emma Williams",
        email: "emma@globalsys.com"
      }
    ];

    const createdLeads = [];
    for (const leadData of leads) {
      const existing = await db.queryRow<{ id: string }>`
        SELECT id FROM marketing_leads WHERE lower(email) = lower(${leadData.email})
      `;

      if (existing) {
        createdLeads.push(existing.id);
      } else {
        const newLead = await db.queryRow<{ id: string }>`
          INSERT INTO marketing_leads (
            company_name, contact_name, email, source_type, 
            owner_user_id, marketing_stage, intent_score
          ) VALUES (
            ${leadData.company_name}, ${leadData.contact_name}, ${leadData.email},
            'website', 'system', 'M1', 0
          )
          RETURNING id
        `;
        createdLeads.push(newLead!.id);
      }
    }

    const eventTemplates = [
      { type: "link_clicked", days_ago: [1, 3, 5, 7] },
      { type: "inbound_message", days_ago: [2, 6] },
      { type: "quote_requested", days_ago: [4] },
      { type: "meeting_booked", days_ago: [8] },
      { type: "post_published", days_ago: [10, 12, 14] },
      { type: "purchase_made", days_ago: [13] }
    ];

    let eventsCreated = 0;

    for (let leadIdx = 0; leadIdx < createdLeads.length; leadIdx++) {
      const leadId = createdLeads[leadIdx];
      const leadEvents = eventTemplates.slice(leadIdx, leadIdx + 4);

      for (const template of leadEvents) {
        for (const daysAgo of template.days_ago) {
          const occurredAt = new Date();
          occurredAt.setDate(occurredAt.getDate() - daysAgo);

          const metadata: Record<string, any> = {};
          if (template.type === "link_clicked") {
            metadata.utm_medium = "social";
            metadata.clicks = Math.floor(Math.random() * 10) + 1;
          } else if (template.type === "post_published") {
            metadata.reach = Math.floor(Math.random() * 10000) + 1000;
          }

          const event = await db.queryRow<{ id: string }>`
            INSERT INTO intent_events (
              lead_id, event_type, event_source, event_value, 
              metadata, occurred_at
            ) VALUES (
              ${leadId}, ${template.type}, 'demo_seed', 0, 
              ${JSON.stringify(metadata)}, ${occurredAt.toISOString()}
            )
            RETURNING id
          `;

          if (event) {
            const eventData = {
              event_type: template.type,
              event_source: 'demo_seed',
              metadata
            };

            const { computeScore } = await import("./engine");
            const scoreResult = await computeScore(eventData);

            await db.exec`
              INSERT INTO intent_scores (
                intent_event_id, score, confidence, reasons, model_version
              ) VALUES (
                ${event.id}, ${scoreResult.score}, ${scoreResult.confidence},
                ${JSON.stringify(scoreResult.reasons)}, 'rules_v1'
              )
              ON CONFLICT (intent_event_id) DO NOTHING
            `;

            eventsCreated++;
          }
        }
      }
    }

    await recomputeScores({ days: 30 });

    return {
      leads_created: createdLeads.length,
      events_created: eventsCreated
    };
  }
);
