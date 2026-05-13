---
name: '🐛 Bug Report'
about: Report a technical issue with the deployment pipeline or dashboard
title: '[BUG] '
labels: bug
assignees: ''
---

**Describe the bug**
A clear and concise description of the issue.

**Deployment Context (if applicable)**
- **Deployment ID**: (e.g., `8f2a1b3c`)
- **Git Repository URL**: (e.g., `https://github.com/user/repo`)

**To Reproduce**
Steps to reproduce the error:
1. Go to the dashboard.
2. Click on 'New Deployment'.
3. Paste the URL '...'
4. See error in build logs: '...'

**Expected behavior**
A clear description of what you expected to happen.

**Screenshots/Logs**
- **Build Logs (Recommended)**: Copy/paste the relevant section from the real-time build console.
- **Server Logs**: (If applicable) Logs from the `server` or `s3-reverse-proxy`.
- **Screenshots**: Attach screenshots of the dashboard if there are UI-related issues.

**Environment (please complete):**
- **OS**: [e.g. Windows, MacOS, Linux]
- **Browser**: [e.g. Chrome, Firefox]
- **Bun/Node Version**: (e.g. Bun v1.3.9)
- **Deployment Mode**: [e.g. Local Docker, AWS ECS Fargate]

**Additional context**
Add any other context about the problem here (e.g., Kafka connection issues, S3 permission errors).
