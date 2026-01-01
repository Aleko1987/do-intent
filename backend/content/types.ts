export interface ContentItem {
  id: string;
  title: string;
  body: string | null;
  creative_url: string | null;
  channels: string[];
  cta_type: string | null;
  target_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  scheduled_at: string | null;
  status: string;
  buffer_post_id: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ContentPostLog {
  id: string;
  content_item_id: string;
  channel: string;
  posted_at: string | null;
  status: string;
  platform_response: Record<string, any>;
  created_at: string;
}
