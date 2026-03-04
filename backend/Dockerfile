# ── Stage 1: Builder ──────────────────────────────────────────────────────────
# Install Python dependencies in an isolated layer so they're cached separately
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build tools (only needed for compiling native extensions like lxml)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libxml2-dev \
    libxslt-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for layer-cache efficiency
COPY requirements.txt .

# Install into a prefix we'll copy to the final image
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Security: run as a non-root user
RUN groupadd --gid 1001 appuser && \
    useradd  --uid 1001 --gid appuser --shell /bin/bash --create-home appuser

WORKDIR /app

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY . .

# jan_sahayak.db is bundled as read-only scheme data — App Runner ephemeral FS is fine for reads
RUN chown -R appuser:appuser /app

USER appuser

# Port declaration (App Runner listens on this)
EXPOSE 8000

# Health check — App Runner polls this automatically
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run uvicorn in production mode (single worker — App Runner scales horizontally)
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1", \
     "--log-level", "info", \
     "--no-access-log"]
