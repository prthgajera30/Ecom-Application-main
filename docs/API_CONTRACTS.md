# API Contracts (Summary)

Base path: `/api`

- Auth: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- Catalog: `GET /products`, `GET /products/:id`, `GET /categories`
- Cart: `POST /cart/add`, `POST /cart/remove`, `GET /cart`
- Checkout: `POST /checkout/create-session`, `POST /webhooks/stripe`
- Orders: `GET /orders`, `GET /orders/:id`
- Recs Proxy: `GET /recommendations` (returns `{ items: [{ score, product }] }`)

All requests validated via Zod in the API gateway. See implementation for details.

- WebSocket events: `cart:updated` (broadcast), `reco:nudge` (room-scoped recommendation payload)
