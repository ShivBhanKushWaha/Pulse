# @shiv-kush/pulse-monitor-plugin-fastify

Fastify integration for [`@shiv-kush/pulse-monitor-sdk`](https://www.npmjs.com/package/@shiv-kush/pulse-monitor-sdk). Records method, route pattern, status code and duration of every request, and mounts the `/_pulse/export` route your Pulse dashboard polls. Requires Fastify 5.12.2 or newer (older versions have known security advisories).

## Install

```
pnpm add @shiv-kush/pulse-monitor-sdk @shiv-kush/pulse-monitor-plugin-fastify
```

## Usage

```ts
import Fastify from "fastify";
import { initMonitoring } from "@shiv-kush/pulse-monitor-sdk";
import { pulseFastify } from "@shiv-kush/pulse-monitor-plugin-fastify";

const app = Fastify();

const monitoring = initMonitoring({
  apiKey: process.env.PULSE_API_KEY!,
  projectId: process.env.PULSE_PROJECT_ID!,
  environment: process.env.NODE_ENV ?? "development",
  storage: myStorageAdapter,
});

pulseFastify(app, monitoring); // before registering your routes

app.get("/", async () => ({ ok: true }));
```

Call `pulseFastify` on the root instance **before** your routes: Fastify hooks only apply to routes added after them.

The export route (`/_pulse/export` by default, change it with `{ exportPath }`) is authenticated with the project's `apiKey` and is not itself recorded as traffic.
