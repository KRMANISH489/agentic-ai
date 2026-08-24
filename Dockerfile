FROM node:20-bookworm-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
ENV API_ORIGIN=http://127.0.0.1:7860
RUN npm run build

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
