# CONTAINER ARCHITECTURE

Version: 1.0

Containers:
- Web (Next.js)
- Worker
- PostgreSQL
- Future Redis (optional)
- Future Observability Stack

Communication:
Web -> Core -> Database
Web -> Queue -> Worker
Worker -> AI Provider -> Database
