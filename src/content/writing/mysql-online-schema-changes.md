---
title: Changing large MySQL tables without taking the site down
description: How I choose between INSTANT, INPLACE, and gh-ost for schema changes on big, busy tables, and the metadata lock that catches everyone once.
date: 2026-09-26
tags: [MySQL, Databases, Operations]
draft: true
---

Schema changes on small tables are boring, which is how they should be. On a large, busy table, the wrong `ALTER TABLE` can block writes for an hour. This is the checklist I run through before touching one.

## Always ask for the algorithm you expect

I never let MySQL pick how to run an `ALTER` on a big table. Stating the algorithm and lock level turns a silent table copy into an immediate error:

```sql
ALTER TABLE orders
  ADD COLUMN source VARCHAR(32) NULL,
  ALGORITHM=INSTANT;
```

If MySQL can't make the change the way I asked, it refuses right away instead of quietly falling back to something slower. That error is the cheapest safety check there is.

## Try INSTANT first

On MySQL 8.0.29 and later, adding or dropping a column, renaming a column, and changing a column default are metadata-only changes. They finish in milliseconds no matter how big the table is.

One catch: a table can only take a limited number of instant column adds and drops (64 on MySQL 8.0) before it needs a full rebuild. `INFORMATION_SCHEMA.INNODB_TABLES` shows the running count in `TOTAL_ROW_VERSIONS`.

## Then INPLACE with LOCK=NONE

Adding a secondary index and many other changes can run in place while reads and writes continue:

```sql
ALTER TABLE orders
  ADD INDEX idx_orders_created_at (created_at),
  ALGORITHM=INPLACE, LOCK=NONE;
```

Two things to plan for:

- **The online log.** Writes that happen during the change are buffered in a log capped by `innodb_online_alter_log_max_size` (128 MB by default). If a busy table overflows it, the `ALTER` fails and all of that work is thrown away.
- **Replica lag.** Replicas start the `ALTER` only after the primary finishes it, then spend about as long applying it while everything behind it waits. A 40-minute index build means 40 minutes of lag.

## Use gh-ost for everything else

For changes that would copy the table, or when replica lag isn't acceptable, I use [gh-ost](https://github.com/github/gh-ost). It builds a shadow table, copies rows in small chunks, follows the binary log for new writes, and throttles itself when replicas fall behind. I postpone the final cut-over until a quiet moment, and gh-ost keeps the old table around afterward in case I need it back.

`pt-online-schema-change` does the same job with triggers instead of the binary log. Both are fine; the point is to never run a blocking table copy on production.

## Watch the metadata lock

This is the one that catches everyone once. Every `ALTER`, even an instant one, needs an exclusive metadata lock on the table for a moment. If a long-running transaction has touched the table, the `ALTER` waits for it to finish, and every new query on that table queues behind the `ALTER`. A millisecond change turns into an outage.

Before the change, I look for old transactions:

```sql
SELECT trx_mysql_thread_id, trx_started, LEFT(trx_query, 80) AS query
FROM information_schema.innodb_trx
ORDER BY trx_started
LIMIT 10;
```

Then I run the `ALTER` with a short lock timeout, so it gives up instead of stalling the application:

```sql
SET SESSION lock_wait_timeout = 5;
ALTER TABLE orders ADD COLUMN source VARCHAR(32) NULL, ALGORITHM=INSTANT;
```

If it times out, nothing happened. I find the long transaction, deal with it, and try again.

## The short version

1. Know the table's size and write rate.
2. Ask for `ALGORITHM=INSTANT`, then `INPLACE, LOCK=NONE`, then reach for gh-ost.
3. Check for long transactions and set `lock_wait_timeout` low.
4. Watch replica lag while the change runs.
5. Know how you'll undo it before you start.
