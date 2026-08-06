# @shiv-kush/pulse-monitor-plugin-express

Express integration for [`@shiv-kush/pulse-monitor-sdk`](https://www.npmjs.com/package/@shiv-kush/pulse-monitor-sdk).
Adds request-timing middleware and mounts the `/_pulse/export` route your Pulse dashboard polls.

## Install

```
pnpm add @shiv-kush/pulse-monitor-sdk @shiv-kush/pulse-monitor-plugin-express
```

## Usage

```ts
import express from "express";
import { initMonitoring } from "@shiv-kush/pulse-monitor-sdk";
import { pulseExpress } from "@shiv-kush/pulse-monitor-plugin-express";

const app = express();

const monitoring = initMonitoring({
  apiKey: process.env.PULSE_API_KEY!,
  projectId: process.env.PULSE_PROJECT_ID!,
  environment: process.env.NODE_ENV ?? "development",
  storage: myStorageAdapter,
});

pulseExpress(app, monitoring);
```

That's it — every request through `app` is now timed and exported (auth'd by `apiKey`) for your
dashboard to poll.
