FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
	wget \
	ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt requirements-postgres.txt ./

# PostgreSQL driver is required by the compose mode (DB_DRIVER=postgresql).
RUN pip install --no-cache-dir -r requirements-postgres.txt

# xwa-sdk: best effort from git (the image is offline-compatible thanks to the
# local fallback envelope in app/events.py).
RUN pip install --no-cache-dir \
	"xwa-sdk @ git+https://github.com/xwebanalysis/xwa-sdk.git#subdirectory=bindings/python" \
	|| echo "xwa-sdk unavailable; using local Event fallback"

COPY ./app ./app

EXPOSE 8010

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010"]
