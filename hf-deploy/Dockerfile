FROM python:3.10-slim

# Install system dependencies (ffmpeg for pydub audio conversion)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY server.py .
COPY webapp/ ./webapp/

# Expose the port HF Spaces expects
EXPOSE 7860

# Run the server
CMD ["python", "server.py"]
