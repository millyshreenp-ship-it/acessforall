FROM mcr.microsoft.com/playwright/python:v1.49.0-noble
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# axe-core pinned; loaded into pages by the scanner
RUN curl -fsSL https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js -o /app/axe.min.js
COPY . .
RUN mkdir -p /data/media
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
