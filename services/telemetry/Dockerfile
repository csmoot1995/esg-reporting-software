# Stage 1: Build
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Stage 2: Production
FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY src/ /app/src/
COPY data/ /app/data/

ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV CONTAINER=1
ENV PORT=8083
ENV PYTHONPATH=/app

EXPOSE 8083
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:8083/health || exit 1

CMD ["python", "-m", "src.app"]
