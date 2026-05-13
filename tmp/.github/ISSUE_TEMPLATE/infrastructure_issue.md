---
name: '⚙️ Infrastructure Issue'
about: Report an issue with setup-s3, setup-sqs, or setup-ecs scripts
title: '[INFRA] '
labels: infrastructure
---

**Which process failed?**
- [ ] `bun run src/scripts/setup-s3.ts`
- [ ] `bun run src/scripts/setup-sqs.ts`
- [ ] `bun run src/scripts/setup-ecs.ts`
- [ ] `bun run src/scripts/setup-kafka.ts`
- [ ] `bun run src/scripts/setup-postgres.ts`
- [ ] `bun run src/scripts/setup-clickhouse.ts`

**Error Message / Terminal Output**
Please paste the full terminal output from the failed script here.

**Your Environment**
- Local OS (Windows/Linux/Mac):
- Bun/Node Version:
- AWS CLI Version (`aws --version`):
- Docker Desktop Version:

**Describe the issue**
What happened? (e.g., IAM permission error, timeout while building ECS image, ECR push failure).

**Additional Context**
- Is your `.env` configured with the correct AWS credentials?
- Region: (e.g., `ap-south-1`)
- Are you behind a corporate proxy?
