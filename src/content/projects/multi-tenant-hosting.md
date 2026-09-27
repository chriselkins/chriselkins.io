---
title: Multi-tenant web hosting platform
area: Infrastructure
summary: Architected and operate a high-security, containerized Linux hosting platform for about 300 customer WordPress sites, with every tenant isolated, redundancy and failover built in, and performance tuned from nginx down to MySQL.
stack: [Linux, Containers, nginx, PHP-FPM, MySQL, Redis, WordPress]
order: 2
featured: true
resume: true
---

- About 300 customer WordPress sites on containerized Linux infrastructure.
- Every site runs as its own Linux user with chrooted SFTP and a dedicated PHP-FPM pool, so one compromised or busy site can't reach or starve its neighbors.
- Redundancy and failover, so a single failure doesn't take sites down.
- MySQL optimization and performance tuning across nginx, PHP-FPM, and Redis object caching.
- Hardened for high security, with TLS certificates issued and renewed automatically.
- Provisioning, patching, and upgrades are automated and happen without disrupting customers.
