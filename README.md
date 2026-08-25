# Agentic AI (Python)

Python se **Agentic AI** banana: model sirf jawab nahi deta — wo **sochta hai, tools chalata hai, result dekhta hai, phir next step leta hai**.

Yeh project framework ke andar hide nahi karta. Aap khud dekh sakte ho agent loop kaise kaam karti hai.

## Agentic AI kya hai?

Normal chatbot:

`user → LLM → text`

Agent:

```
user goal
   ↓
LLM decide: answer now OR call a tool
   ↓
tool runs (search, calculator, Wikipedia, notes)
   ↓
LLM observes the result
   ↓
repeat until the goal is done
```

Is loop ko **ReAct** kehte hain: Reason → Act → Observe.

Is project mein do modes hain:

| Mode | Command | Kya karta hai |
| --- | --- | --- |
| Single agent | `python main.py` | Ek agent tools use karke task complete karta hai |
| Multi-agent crew | `python main.py --crew` | Researcher facts laata hai, Writer final answer likhta hai |

## Setup (Windows)

1. Python 3.10+ install ho.
2. Project folder mein aao:

```powershell
cd "C:\Users\Dell\Desktop\test\Agentic AI"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

3. API key lo. Sabse easy: [Groq](https://console.groq.com/keys) (free, tez).
4. Env file banao:

```powershell
copy .env.example .env
```

`.env` mein `GROQ_API_KEY=...` paste karo.

## Web app (v1.4.0)

Browser UI **Next.js** par hai. Pehle API, phir frontend:

```powershell
.\.venv\Scripts\python.exe app.py
```

Dusri window:

```powershell
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:3000** (Google login ke liye `127.0.0.1` use karo, `localhost` nahi).

Features: login, chat, tools, edit a sent message, voice in/out.

Live deploy: **Vercel alone cannot run this app** (Next.js + Python FastAPI). Use a free Docker host instead:

1. Open [Render](https://render.com) → New → Web Service → connect `KRMANISH489/agentic-ai`
2. Runtime: **Docker**
3. Add env `GROQ_API_KEY` (from [console.groq.com/keys](https://console.groq.com/keys))
4. Deploy — public URL Render khud set karega (`RENDER_EXTERNAL_URL`)

Hugging Face Spaces (Docker, `app_port` 3000) bhi free hai.

Vercel par `ERR_TOO_MANY_REDIRECTS` tab aata hai jab `FRONTEND_URL` khali/`/` ho: API khud ko `/` par redirect karti rehti hai. Vercel Settings → Environment Variables se empty `FRONTEND_URL` hatao, ya Root Directory `frontend` set karo (UI chalega, chat API nahi — FastAPI Vercel pe nahi chalti).

CLI:

```powershell
python main.py
```

Ek hi sawal:

```powershell
python main.py -q "Aaj India ka date/time kya hai, aur 345 * 89 kitna hota hai?"
```

Research team:

```powershell
python main.py --crew -q "Agentic AI ke 3 real business use cases batao"
```

Ollama local use karna ho to `.env` mein:

```
LLM_PROVIDER=ollama
LLM_MODEL=llama3.2
```

## Project structure

```
agentic_ai/     → ReAct agent, tools, auth
frontend/       → Next.js chat UI
app.py          → FastAPI API (port 7860)
Dockerfile      → one-container live deploy
main.py         → CLI
```

## Apna tool kaise add karein

`agentic_ai/tools.py` mein naya `Tool(...)` banao aur `builtin_tools()` list mein add karo.

Ya sirf ek agent ko custom tools do:

```python
from agentic_ai import Agent, Tool

def greet(name: str) -> str:
    return f"Hello, {name}"

my_tool = Tool(
    name="greet",
    description="Greet a person by name",
    parameters={
        "type": "object",
        "properties": {"name": {"type": "string"}},
        "required": ["name"],
    },
    handler=greet,
)

agent = Agent(tools=[my_tool])
print(agent.ask("Greet Riya"))
```

## Next level

Jab yeh loop clear ho jaye, production ke liye yeh frameworks try karo:

- **LangGraph** — stateful, branching workflows
- **Pydantic AI** — typed, FastAPI-style agents
- **CrewAI** — role-based multi-agent teams

Pehle is repo ko run karo. Phir ek apna tool likho. Uske baad ek naya agent role banao.
