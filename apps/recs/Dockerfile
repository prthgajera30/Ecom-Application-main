# syntax=docker/dockerfile:1
FROM python:3.11-slim AS base
WORKDIR /usr/src/app
COPY apps/recs/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS dev
COPY apps/recs ./
EXPOSE 5000
CMD ["flask","--app","app.py","run","--host=0.0.0.0","--port=5000"]

FROM base AS prod
COPY apps/recs ./
ENV PYTHONUNBUFFERED=1
EXPOSE 5000
CMD ["gunicorn","--bind","0.0.0.0:5000","app:app"]
