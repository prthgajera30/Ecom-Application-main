# System Patterns & Architecture

## System Architecture

### Microservices Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js Web   │    │   API Service   │    │   Recs Service  │
│   (Port 3000)   │◄──►│   (Port 4000)   │◄──►│   (Port 5000)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   (Port 5432)   │
                    └─────────────────┘
```

### Service Boundaries
- **web**: Frontend application, user interface, client-side logic
- **api**: REST API, business logic, database operations, authentication
- **recs**: Machine learning service, recommendation algorithms, data processing

## Key Technical Decisions

### 1. Monorepo Structure
- **Decision**: Single repository containing all services using pnpm workspaces
- **Rationale**: Enables code sharing, atomic changes, consistent tooling
- **Implementation**: Root package.json with shared dependencies and scripts

### 2. Database Architecture
- **Decision**: PostgreSQL with Prisma ORM
- **Rationale**: Type safety, migration management, development experience
- **Patterns**: Single source of truth for schema, generated TypeScript types

### 3. API Design
- **Decision**: RESTful API with JSON Schema validation
- **Rationale**: Standards compliance, tooling ecosystem, client compatibility
- **Patterns**: Consistent error responses, pagination, versioning strategy

### 4. State Management (Frontend)
- **Decision**: React Context + Zustand for global state
- **Rationale**: Avoid prop drilling, server-side rendering compatibility
- **Patterns**: Domain-specific context providers, optimistic updates

## Design Patterns

### Repository Pattern (API Service)
```typescript
// Pattern: Abstract data access behind interfaces
class ProductRepository {
  async findById(id: string): Promise<Product | null>
  async findMany(params: FindManyParams): Promise<Product[]>
  async create(data: CreateProductData): Promise<Product>
}
```

### Service Layer Pattern
```typescript
// Pattern: Business logic separated from controllers
class CartService {
  constructor(private cartRepo: CartRepository) {}

  async addToCart(userId: string, productId: string): Promise<Cart> {
    // Validation, business rules, data transformation
  }
}
```

### Component Composition (Frontend)
```tsx
// Pattern: Reusable UI components with composition
function ProductCard({ product, onAddToCart }) {
  return (
    <Card>
      <ProductImage product={product} />
      <ProductInfo product={product} />
      <AddToCartButton onClick={onAddToCart} />
    </Card>
  )
}
```

### Middleware Pattern (API)
```typescript
// Pattern: Request/response processing pipeline
app.use(corsMiddleware)
app.use(authMiddleware)
app.use(validationMiddleware)
app.use(errorHandlerMiddleware)
```

## Component Relationships

### API Layer Dependencies
```
Routes → Middleware → Services → Repositories → Database
    ↑           ↑           ↑           ↑           ↑
  Express    Auth        Business    Data       Prisma
                        Logic       Access     Schema
```

### Frontend Layer Dependencies
```
Pages → Components → Context → API Client → Services
   ↑         ↑           ↑           ↑         ↑
  Next.js   React      Zustand     Fetch    External
  Routing   Components  Store     HTTP       APIs
```

### Service Communication Patterns

#### Synchronous Communication
- **HTTP REST**: Web ↔ API for CRUD operations, authentication
- **WebSocket**: Real-time updates for cart changes, order status

#### Asynchronous Communication (Future)
- **Message Queue**: Could use Redis/RabbitMQ for background jobs
- **Event Streaming**: Could use Kafka for analytics, search indexing

## Critical Implementation Paths

### 1. Product Catalog Flow
```
User Request → API Route → Catalog Service → Product Repo → Database
                                                      ↓
Response ← JSON Formatter ← Cached Data ← Cache Layer (Future)
```

### 2. Checkout Flow
```
Cart Validation → Inventory Check → Payment Processing → Order Creation
     ↓                ↓                  ↓                  ↓
Error Handling    Stock Update     Payment Gateway    Database Transaction
```

### 3. Recommendation Flow
```
User Action → API Webhook → Recs Service → ML Model → Personalized Results
     ↓            ↓            ↓            ↓              ↓
     Event Logging  Queue Job   Feature       Prediction    Cache Storage
                    Processing  Extraction    Generation     (Redis)
```

## Security Patterns

### Authentication Flow
```
Login Request → Credential Validation → JWT Generation → Cookie Storage
     ↓               ↓                      ↓              ↓
Password Hash      Database Lookup      Secret Signing    HttpOnly Cookie
Verification                                     ↓
                                      Expiration & Refresh
```

### Authorization Pattern
```typescript
// Route-level middleware checks permissions
const requireAuth = (allowedRoles: UserRole[]) =>
  (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
```

## Error Handling Patterns

### API Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid product data",
    "details": {
      "field": "price",
      "issue": "must be positive number"
    }
  }
}
```

### Frontend Error Boundaries
```tsx
<ErrorBoundary fallback={<ErrorFallback />}>
  <ProductPage />
</ErrorBoundary>
```

## Performance Patterns

### Database Optimization
- Connection pooling with Prisma
- Strategic indexing on frequently queried columns
- N+1 query elimination with `include` and `select`

### Frontend Optimization
- Static generation for product catalog pages
- Image optimization with Next.js Image component
- Code splitting and lazy loading

### Caching Strategy
- HTTP caching headers for static assets
- Database query result caching (future Redis implementation)
- Computed recommendation caching in Recs service
