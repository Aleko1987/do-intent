export interface AccountSummary {
  account_id: string;
  domain: string;
  display_name: string | null;
  account_score: number;
  active_people_14d: number;
  people_total: number;
}

export interface ListAccountsRequest {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListAccountsResponse {
  accounts: AccountSummary[];
  total: number;
}

export interface GetAccountRequest {
  account_id: string;
}

export interface AccountPersonScore {
  identity_id: string;
  email: string;
  total_score: number;
  last_event_at: string | null;
}

export interface GetAccountResponse {
  account: AccountSummary;
  top_people: AccountPersonScore[];
}


