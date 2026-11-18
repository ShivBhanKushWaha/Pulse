# The Pulse dashboard (UI + API) as a container. Data (database + keys) lives in /data: mount a volume there.
FROM node:22-alpine

RUN npm install -g @shiv-kush/pulse-dashboard

ENV PULSE_DATA_DIR=/data
# Run as the image's unprivileged "node" user; /data must be writable by it.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4500
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \n  CMD wget -qO- http://127.0.0.1:4500/health >/dev/null || exit 1

# 0.0.0.0 so the port is reachable from outside the container.
CMD ["pulse-dashboard", "--host", "0.0.0.0", "--port", "4500"]
