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
