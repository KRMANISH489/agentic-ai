FROM node:20-bookworm-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
# npm 10 (this image) is stricter than npm 11 about lockfile sync.
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY frontend ./
ENV API_ORIGIN=http://127.0.0.1:7860
ENV NEXT_PUBLIC_SITE_URL=https://agentic-ai-d0cx.onrender.com
ENV NEXT_TELEMETRY_DISABLED=1
# Webpack build: package.json "build" uses turbopack, which is for local dev.
RUN npx next build

FROM python:3.12-slim-bookworm
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
COPY agentic_ai ./agentic_ai
COPY static ./static
COPY --from=frontend /frontend /app/frontend
COPY start.sh /start.sh
RUN chmod +x /start.sh && sed -i 's/\r$//' /start.sh

ENV PORT=3000
ENV OPEN_BROWSER=0
EXPOSE 3000
CMD ["/start.sh"]
