# @shiv-kush/pulse-monitor-adapter-mongoose

`StorageAdapter` for [`@shiv-kush/pulse-monitor-sdk`](https://www.npmjs.com/package/@shiv-kush/pulse-monitor-sdk) that keeps Pulse records in **your own MongoDB**, in one collection. It uses your existing connection and opens none of its own.

## Install

```
pnpm add @shiv-kush/pulse-monitor-sdk @shiv-kush/pulse-monitor-adapter-mongoose
```

## Usage

```ts
import mongoose from "mongoose";
import { initMonitoring } from "@shiv-kush/pulse-monitor-sdk";
import { createMongooseStorage } from "@shiv-kush/pulse-monitor-adapter-mongoose";

await mongoose.connect(process.env.MONGO_URI!);

const monitoring = initMonitoring({
  apiKey: process.env.PULSE_API_KEY!,
  projectId: process.env.PULSE_PROJECT_ID!,
  environment: process.env.NODE_ENV ?? "development",
  storage: createMongooseStorage({ connection: mongoose.connection }),
});
```

## Options

| Option | Default | |
|---|---|---|
| `connection` | required | `mongoose.connection` (or a native driver `Db`). |
| `collectionName` | `pulse_records` | Keep the `pulse_` prefix so it never clashes with app data. |
| `retentionDays` | `7` | Records expire in MongoDB itself (TTL index on `expireAt`). `0` keeps them forever. |

## How it behaves

- The record `id` is the document `_id`, so a batch written twice (a retry after a failed write) is deduplicated by MongoDB; duplicate-key errors are ignored.
- `readSince` is inclusive (`ts >= sinceTs`), sorted by `ts` then `_id`, as the SDK contract requires.
- `init()` creates the indexes `{ ts: 1, _id: 1 }` and, when retention is on, `{ expireAt: 1 }` with `expireAfterSeconds: 0`.
