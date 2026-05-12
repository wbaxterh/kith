FROM python:3.11-slim AS python-base
RUN pip install uv
COPY packages/runtime-pipecat/python /app/python
WORKDIR /app/python
RUN uv venv && . .venv/bin/activate && uv pip install -e .

FROM oven/bun:1.3
COPY --from=python-base /app/python /app/python
COPY --from=python-base /usr/local/bin/python3.11 /usr/local/bin/python3.11
COPY --from=python-base /usr/local/lib/python3.11 /usr/local/lib/python3.11
WORKDIR /app/server
COPY packages/server/package.json .
COPY packages/server/src ./src
COPY packages/server/characters ./characters
RUN bun install
ENV PIPECAT_PYTHON_PATH=/app/python/.venv/bin/python
ENV PIPECAT_PYTHON_CWD=/app/python
ENV PORT=3040
EXPOSE 3040
CMD ["bun", "src/index.ts"]
