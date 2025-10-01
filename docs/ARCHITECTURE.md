# Architecture

- Next.js web (apps/web) communicates with API gateway (apps/api) over REST and Socket.IO.
- API gateway connects to Postgres (orders/users) and MongoDB (catalog, sessions), and proxies to Flask recs (apps/recs).
- Nginx front proxy exposes web at `/`, API at `/api`, and recs at `/recs`.
