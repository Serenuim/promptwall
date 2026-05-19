FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .

# Upgrade torch to 2.4.0 (has get_default_device + numpy 2.x support)
RUN pip install --no-cache-dir --timeout 600 \
    --index-url https://download.pytorch.org/whl/cpu \
    torch==2.4.0

RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt

# No longer need the numpy<2 hack since torch 2.4+ supports numpy 2.x
COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]