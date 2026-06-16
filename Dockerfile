# ============================================================
# RGS - Multi-stage Dockerfile
# ============================================================

# Build stage
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Production stage
FROM python:3.11-slim

# Create non-root user
RUN groupadd -r rgsuser && useradd -r -g rgsuser -d /app -m rgsuser

WORKDIR /app

# Copy installed Python packages
COPY --from=builder /install /usr/local

# Copy application code
COPY app.py .
COPY templates/ templates/
COPY static/ static/
COPY .env.example .env.example
COPY .gitignore .

# Create necessary directories
RUN mkdir -p /app/Reports /app/logs && chown -R rgsuser:rgsuser /app

# Switch to non-root user
USER rgsuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/auth/status')" || exit 1

# Run with Gunicorn (production WSGI server)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "--access-logfile", "-", "app:app"]
