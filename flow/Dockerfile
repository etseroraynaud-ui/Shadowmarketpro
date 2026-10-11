# Image du collecteur Market Flow (flow/collector.py). Construite depuis flow/ :
#   docker build -t market-flow-collector flow
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 FLOW_DATA_DIR=/data
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY collector.py .

# Catalogue des comptes Hyperliquid et historique local dans /data (volume : survivent aux mises à jour).
RUN useradd -r -u 10001 flow && mkdir -p /data && chown flow /data
VOLUME /data
USER flow

# Sain si la boucle de publication a tourné dans les 5 dernières minutes.
HEALTHCHECK --interval=60s --timeout=5s --start-period=180s \
  CMD python -c "import os,sys,time; f='/data/heartbeat'; sys.exit(0 if os.path.exists(f) and time.time()-os.path.getmtime(f) < 300 else 1)"
CMD ["python", "collector.py"]
