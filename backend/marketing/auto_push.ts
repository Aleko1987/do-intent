import db from "../db";
import type { MarketingLead } from "./types";

interface AutoPushResult {
  pushed: boolean;
  customer_id?: string;
  message?: string;
}

export async function checkAndPushToSales(leadId: string): Promise<AutoPushResult> {
  const lead = await db.queryRow<MarketingLead>`
    SELECT * FROM marketing_leads WHERE id = ${leadId}
  `;

  if (!lead) {
    return { pushed: false, message: "Lead not found" };
  }

  if (!lead.auto_push_enabled) {
    return { pushed: false, message: "Auto-push disabled for this lead" };
  }

  if (lead.sales_customer_id) {
    return { pushed: false, message: "Already pushed to sales" };
  }

  if (lead.marketing_stage !== "M5" && lead.intent_score < 31) {
    return { pushed: false, message: "Not ready for sales push" };
  }

  // Create sales customer record
  // Note: Adjust table/column names based on your existing sales schema
  const customerId = await db.queryRow<{ id: string }>`
    INSERT INTO customers (
      company_name,
      contact_name,
      email,
      phone,
      source,
      stage,
      created_at,
      updated_at
    ) VALUES (
      ${lead.company_name},
      ${lead.contact_name},
      ${lead.email},
      ${lead.phone},
      'marketing',
      'Stage 1',
      now(),
      now()
    )
    RETURNING id
  `;

  if (!customerId) {
    return { pushed: false, message: "Failed to create customer" };
  }

  // Create follow-up task
  await db.exec`
    INSERT INTO tasks (
      customer_id,
      title,
      description,
      due_date,
      priority,
      status,
      created_at
    ) VALUES (
      ${customerId.id},
      'Call + qualify within 24h',
      'Auto-pushed from marketing (M5 intent stage)',
      now() + interval '24 hours',
      'high',
      'pending',
      now()
    )
  `;

  // Update marketing lead with sales reference
  await db.exec`
    UPDATE marketing_leads
    SET 
      sales_customer_id = ${customerId.id},
      updated_at = now()
    WHERE id = ${leadId}
  `;

  // Log audit event
  await db.exec`
    INSERT INTO intent_events (
      lead_id,
      event_type,
      event_source,
      event_value,
      metadata,
      occurred_at
    ) VALUES (
      ${leadId},
      'auto_pushed_to_sales',
      'system',
      0,
      ${JSON.stringify({ customer_id: customerId.id })},
      now()
    )
  `;

  return {
    pushed: true,
    customer_id: customerId.id,
    message: "Successfully pushed to sales",
  };
}
