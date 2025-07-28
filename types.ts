export interface TelegramUser {
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  language_code?: string | null;
  is_bot?: boolean | null;
  is_premium?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// types.ts
export interface ChatMessage {
  id: number | string;
  type: string;
  text: string;
  date: string;
  from?: string;
  [key: string]: any;
}

export interface ChatData {
  id: number | string;
  messages: ChatMessage[];
  [key: string]: any;
}
