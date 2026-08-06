# @shiv-kush/pulse-monitor-sdk

Core SDK for [Pulse](https://github.com/) — a self-hosted monitoring platform. Install this in any
Node.js backend to start collecting metrics into **your own database**. Nothing is sent to a
third-party server; a separate dashboard you host polls a small export route this SDK exposes.

## Install

```
pnpm add @shiv-kush/pulse-monitor-sdk
```

Add a framework plugin too, e.g. for Express:

```
pnpm add @shiv-kush/pulse-monitor-plugin-express
```

## Usage

```ts
import { initMonitoring } from "@shiv-kush/pulse-monitor-sdk";
import { pulseExpress } from "@shiv-kush/pulse-monitor-plugin-express";

const monitoring = initMonitoring({
  apiKey: process.env.PULSE_API_KEY!,
  projectId: process.env.PULSE_PROJECT_ID!,
  environment: process.env.NODE_ENV ?? "development",
  storage: myStorageAdapter, // writes into YOUR existing database
});

pulseExpress(app, monitoring);
```

`storage` is any object implementing the `StorageAdapter` interface (`init`, `write`, `readSince`) —
back it with Mongoose, Prisma, raw `pg`, or anything else your project already uses.

## What it collects automatically

- HTTP requests: method, route, status code, duration (via a framework plugin)
- Process metrics: memory, uptime, load average (sampled every 15s)

Call `monitoring.record({ kind, data })` to push custom events (errors, auth events, business metrics).
