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

Reviews
-------

GET /api/products/:id/reviews
- Returns a paginated list of reviews for the product. Response shape:

	{
		items: [
			{
				id: string,
				productId: string,
				userId?: string,
				rating: number,
				title?: string,
				body?: string,
				verified: boolean,
				helpfulCount: number,
				authorName?: string,
				reviewedAt?: string,
				// new: indicates whether the requesting (authenticated) user has marked this review helpful
				markedByCurrentUser?: boolean
			}
		],
		total: number,
		hasMore: boolean,
		limit: number,
		offset: number
	}

Notes:
- If the request is authenticated (Authorization: Bearer <token>), the API will include `markedByCurrentUser: true` on reviews the user has previously marked helpful. For anonymous requests this field will be false or omitted.

Auth responses
--------------

POST /api/auth/login and POST /api/auth/register
- On successful login/register the API returns an object containing the auth token and a small payload of user state. New field:

	{
		token: string,
		marked: string[] // array of review IDs that the user has marked helpful
	}

This allows the client to hydrate local state (for example `localStorage.markedReviews`) without an additional API call.

