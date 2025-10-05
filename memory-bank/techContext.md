# Technical Context

## Technology Stack

### Frontend (Web Application)
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript 5.0+
- **Styling**: Tailwind CSS + PostCSS
- **State Management**: React Context + Zustand
- **UI Components**: Custom component library with Radix UI primitives
- **Forms**: React Hook Form with Zod validation
- **Testing**: Playwright (E2E), Jest (unit/integration)

### Backend (API Service)
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript 5.0+
- **Database ORM**: Prisma 5.0+
- **Database**: PostgreSQL 15+
- **Authentication**: JWT with bcrypt password hashing
- **Validation**: Zod schemas
- **Testing**: Jest with Supertest

### Machine Learning (Recs Service)
- **Runtime**: Python 3.11+
- **Framework**: Flask (API) + scikit-learn (ML)
- **Dependencies**: pandas, numpy, joblib
- **Testing**: pytest
- **Model Storage**: pickle/joblib serialization

### Infrastructure & DevOps
- **Containerization**: Docker + Docker Compose
- **Package Management**: pnpm (monorepo workspaces)
- **Version Control**: Git with conventional commits
- **CI/CD**: GitHub Actions (future implementation)
- **Reverse Proxy**: nginx (production)
- **Process Management**: PM2 (production API)

## Development Environment Setup

### Prerequisites
- **Node.js**: 20.0.0+ (managed via .nvmrc)
- **pnpm**: 8.0.0+
- **Docker**: 24.0.0+
- **Python**: 3.11.0+ (for recs service)
- **Git**: 2.30.0+

### Local Development
```bash
# Clone and setup
git clone <repository>
cd Ecom-Application-main

# Install dependencies
pnpm install

# Start services with Docker
pnpm run dev:services

# Start development servers
pnpm run dev

# Database setup
pnpm run db:migrate
pnpm run db:seed
```

### Environment Variables
- **Development**: `.env.local` files in each app directory
- **Production**: Environment-specific configs via Docker secrets
- **Required Variables**: Database URLs, JWT secrets, API keys

## Technical Constraints & Decisions

### Architecture Constraints
- **Monorepo**: Single repository for atomic changes and dependency management
- **Microservices**: Clear service boundaries with API contracts
- **Stateless Services**: Horizontal scaling capability
- **RESTful APIs**: Industry standard, tooling ecosystem compatibility

### Performance Constraints
- **Frontend**: <2s initial page load, <1s subsequent navigation
- **API**: <500ms average response time for catalog operations
- **Database**: Optimized queries, proper indexing, connection pooling
- **Images**: CDN delivery, format optimization, lazy loading

### Security Constraints
- **Authentication**: JWT with secure storage, password complexity requirements
- **HTTPS**: SSL/TLS encryption for all production traffic
- **Data Protection**: GDPR compliance, secure credential storage
- **Input Validation**: Schema validation on all API endpoints

### Scalability Constraints
- **Service Independence**: Independent scaling of web, API, and recs services
- **Database Sharding**: Future capability for horizontal database scaling
- **Caching Layer**: Redis integration points prepared
- **CDN Integration**: Static asset optimization and global distribution

## Dependency Management

### pnpm Workspace Configuration
```
Ecom-Application-main/
├── packages/        # Shared packages (config, ui)
├── apps/           # Application services
│   ├── api/        # Backend service
│   ├── web/        # Frontend application
│   └── recs/       # ML recommendation service
└── package.json    # Root dependencies and scripts
```

### Shared Packages
- **@ecom/config**: ESLint, TypeScript, testing configuration
- **@ecom/ui**: Reusable React components and design system

### Critical Dependencies
- **Runtime**: Node.js 20+, Python 3.11+, PostgreSQL 15+
- **Build Tools**: TypeScript, esbuild, webpack
- **Testing**: Jest, Playwright, pytest
- **Database**: Prisma Client, PostgreSQL driver

## Tool Usage Patterns

### Development Workflow
```bash
# Code quality checks
pnpm run lint        # ESLint across all TypeScript files
pnpm run type-check # TypeScript compilation check
pnpm run test       # Run test suites

# Database operations
pnpm run db:migrate  # Apply Prisma migrations
pnpm run db:seed    # Populate development data
pnpm run db:studio  # Open Prisma Studio GUI

# Service management
pnpm run dev        # Start all development servers
pnpm run dev:web    # Start only web service
pnpm run dev:api    # Start only API service
pnpm run dev:recs   # Start only recommendations service
```

### Docker Development
```bash
# Full stack development
docker-compose up -d postgres redis
pnpm run dev

# Individual service development
docker-compose up -d postgres
cd apps/api && pnpm run dev

# Production simulation
docker-compose -f docker-compose.prod.yml up
```

### Testing Strategy
- **Unit Tests**: Individual functions, components, utilities
- **Integration Tests**: API endpoints, database operations
- **E2E Tests**: Complete user flows, browser automation
- **Test Coverage**: >80% target for critical business logic

### Code Organization Patterns

#### API Service Structure
```
apps/api/
├── src/
│   ├── routes/      # HTTP route handlers
│   ├── services/    # Business logic layer
│   ├── middleware/  # Express middleware
│   └── __tests__/   # Test files
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── package.json
```

#### Web Application Structure
```
apps/web/
├── app/             # Next.js App Router pages
├── components/      # React components
├── context/         # React Context providers
├── lib/             # Utilities and API clients
└── __tests__/       # Test files
```

#### Recommendations Service Structure
```
apps/recs/
├── app.py           # Flask application
├── tests/           # pytest test files
└── requirements.txt
```

## Version Control & Release Management

### Commit Convention
```
feat: add user authentication
fix: resolve cart persistence bug
docs: update API documentation
refactor: simplify checkout flow
test: add product variant tests
```

### Release Process
- **Semantic Versioning**: Major.minor.patch based on changes
- **Changelog Generation**: Automated from conventional commits
- **Tag Creation**: Git tags for each release
- **Docker Images**: Tagged and pushed to registry

## Monitoring & Observability

### Current State
- **Health Checks**: Basic /health endpoints on all services
- **Error Logging**: Console logging with structured data
- **Performance Monitoring**: Development-time metrics

### Future Enhancements
- **APM**: Application Performance Monitoring (New Relic, DataDog)
- **Log Aggregation**: Centralized logging with ELK stack
- **Metrics Collection**: Prometheus + Grafana dashboards
- **Distributed Tracing**: Request tracing across services
