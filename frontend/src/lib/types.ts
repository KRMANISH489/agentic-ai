export type User = {
  name: string;
  email: string;
  picture?: string;
  provider?: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatItem = {
  id: string;
  title: string;
  mode: string;
  updatedAt: number;
  messages: ChatMessage[];
  projectId?: string;
};

export type ProjectFile = {
  id: string;
  title: string;
  text: string;
};

export type Project = {
  id: string;
  name: string;
  instructions: string;
  files: ProjectFile[];
};

export type ToolItem = {
  id: string;
  title: string;
  blurb: string;
  category: string;
  icon: string;
  installed: boolean;
};

export type Prefs = {
  show_thinking?: boolean;
  enter_to_send?: boolean;
  voice_read_aloud?: boolean;
  voice_auto_send?: boolean;
  max_steps?: number;
  temperature?: number;
  default_mode?: string;
  installed_tools?: string[];
  teach_instructions?: string;
  teach_memory?: string;
  teach_notes?: { id: string; title: string; text: string; builtin?: boolean }[];
};

export type AppState = {
  ok: boolean;
  version?: string;
  provider?: string | null;
  model?: string | null;
  error?: string | null;
  prefs?: Prefs;
  tools?: ToolItem[];
};

export type BillingPack = {
  id: string;
  title: string;
  blurb: string;
  price_inr: number;
  chat_credits: number;
  photo_credits: number;
};

export type BillingStatus = {
  configured: boolean;
  free_chats_per_day: number;
  free_photos_per_day: number;
  free_chats_left: number;
  free_photos_left: number;
  paid_chat_credits: number;
  paid_photo_credits: number;
  chats_left: number;
  photos_left: number;
  packs: BillingPack[];
};
