# SECURITY POLICY

Version: 1.0

## Principles

- Never share private keys.
- Never share API secrets.
- Never share production credentials.
- Prefer local environment variables.
- Review permissions before connecting external services.

## AI Policy

AI agents must never receive:

- GitHub Personal Access Tokens
- SSH private keys
- Database passwords
- OpenAI API keys
- Cloud credentials

Humans execute privileged operations.
