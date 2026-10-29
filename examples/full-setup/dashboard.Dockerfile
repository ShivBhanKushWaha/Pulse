# The Pulse dashboard (UI + API) as a container. Data (database + keys) lives in /data: mount a volume there.
FROM node:22-alpine

RUN npm install -g @shiv-kush/pulse-dashboard

ENV PULSE_DATA_DIR=/data
VOLUME /data
EXPOSE 4500

# 0.0.0.0 so the port is reachable from outside the container.
CMD ["pulse-dashboard", "--host", "0.0.0.0", "--port", "4500"]
