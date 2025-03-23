FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# install python dependecies remember pip-compile might not resolve on private networks
# COPY requirements.in .
COPY requirements.txt .
RUN python -m pip install --no-cache-dir -U pip pip-tools
# RUN pip-compile -q --no-annotate --resolver=backtracking requirements.in
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY . /app

# Creates a non-root user
RUN adduser -u 5678 --disabled-password --gecos "" pricing_engine_admin && chown -R pricing_engine_admin /app
USER pricing_engine_admin