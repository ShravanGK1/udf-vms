# Use an official lightweight Python runtime
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=5000
ENV HOME=/home/vmsuser

# Install system dependencies (build-essential needed for some C-extensions like pandas/numpy)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Setup non-root application user
RUN groupadd -g 10001 vmsgroup && \
    useradd -u 10000 -g vmsgroup -m -d $HOME -s /bin/bash vmsuser

# Set work directory
WORKDIR /app

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir gunicorn

# Copy backend source code
COPY . .

# Create directories for uploaded images and assign ownership to non-root user
RUN mkdir -p uploads uploads_users \
    && chown -R vmsuser:vmsgroup /app \
    && chmod -R 775 /app/uploads /app/uploads_users

# Expose backend port
EXPOSE 5000

# Run as non-root user
USER vmsuser

# Start Flask application using Gunicorn WSGI server
CMD ["gunicorn", "--workers", "3", "--timeout", "120", "--bind", "0.0.0.0:5000", "app:app"]
