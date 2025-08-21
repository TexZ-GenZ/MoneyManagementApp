FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DEFAULT_TIMEOUT=180

# Install dependencies (upgrade pip to latest for better resolver / wheels availability)
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code and startup script
COPY app /app/app
# Include Alembic migration assets
COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 8000
# Use start script so migrations run automatically (suitable for Railway & other PaaS)
CMD ["/app/start.sh"]
