# VM Sharing Platform - Backend

A NestJS backend for a VM resource sharing platform where users can provide their computing resources or rent VMs from others.

## Features

- **User Authentication**: JWT-based authentication with bcrypt password hashing
- **VM Management**: Register, list, filter, and manage virtual machines
- **Rental System**: Rent VMs, track usage, and manage rentals
- **Job Execution**: Upload and execute work/code on rented VMs
- **Usage Monitoring**: Track CPU, RAM, and GPU usage metrics
- **Payment Simulation**: Simulated payment processing
- **Resource Calculator**: Calculate resource requirements based on workload type
- **Python Client Script**: Auto-generated Python script for VM providers

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL
- **ORM**: TypeORM
- **Authentication**: JWT with Passport
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or pnpm

## Installation

### Option 1: Docker (Recommended)

The easiest way to run the application is using Docker:

1. Clone the repository:

```bash
git clone <repository-url>
cd Hack-TUES-12-backend
```

2. Start with Docker Compose (Production):

```bash
docker-compose up -d
```

Or for development with hot reload:

```bash
docker-compose -f docker-compose.dev.yml up
```

The API will be available at `http://localhost:3000`
Swagger documentation at `http://localhost:3000/api`

**Docker Commands:**

```bash
# Start containers
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop containers
docker-compose down

# Rebuild after code changes
docker-compose up --build

# Remove volumes (deletes database data)
docker-compose down -v
```

### Option 2: Local Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd Hack-TUES-12-backend
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials and other configuration.

4. Create PostgreSQL database:

```bash
createdb vm_sharing
```

5. Run the application (with synchronize enabled in development):

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`
Swagger documentation at `http://localhost:3000/api`

## Database Schema

### Users

- Stores user credentials (username, email, hashed password)
- Users can be both providers and receivers

### Virtual Machines

- VM specifications (CPU, GPU, RAM, storage, OS)
- Connection token for Python client authentication
- Status tracking (available, running, setup, maintenance, offline)
- Price per hour set by provider

### VM Rentals

- Tracks active and completed rentals
- Calculates total cost based on usage time
- Payment status (pending, paid, refunded)

### VM Jobs

- Work to be executed on rented VMs
- Supports script, docker, and command job types
- Stores execution results

### VM Usage Metrics

- CPU, RAM, and GPU usage tracking
- Timestamped metrics for monitoring

## API Endpoints

### Authentication

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/profile` - Get current user profile

### Virtual Machines

- `POST /vms` - Register a new VM (provider)
- `GET /vms` - List all VMs with filters
- `GET /vms/:id` - Get VM details
- `GET /vms/:id/download-script` - Download Python client script
- `PATCH /vms/:id/status` - Update VM status
- `POST /vms/:id/heartbeat` - VM heartbeat (Python script)
- `DELETE /vms/:id` - Delete VM

### Rentals

- `POST /rentals` - Start a rental
- `GET /rentals` - List user's rentals
- `GET /rentals/:id` - Get rental details
- `PATCH /rentals/:id/end` - End a rental
- `POST /rentals/:id/pay` - Simulate payment

### Jobs

- `POST /rentals/:rentalId/jobs` - Upload work to execute
- `GET /rentals/:rentalId/jobs` - List jobs for a rental
- `GET /vms/:vmId/jobs/pending` - Get pending jobs (Python script)
- `POST /jobs/:jobId/result` - Report job result (Python script)

### Metrics

- `POST /metrics/rental/:rentalId` - Record usage metric
- `GET /metrics/rental/:rentalId` - Get metrics for a rental

### Calculator

- `POST /calculator/estimate` - Calculate resource requirements

## Python Client Script

When a provider registers a VM, they can download a Python script that:

- Sends heartbeat every 30 seconds
- Polls for pending jobs every 10 seconds
- Executes jobs (commands, scripts, Docker containers)
- Reports job results back to the server
- Records usage metrics every minute

### Running the Python Client

1. Download the script from `/vms/:id/download-script`
2. Install dependencies:

```bash
pip install requests
```

3. Run the script:

```bash
python vm_client_<vm-id>.py
```

## Development

### Run in development mode:

```bash
npm run start:dev
```

### Build for production:

```bash
npm run build
npm run start:prod
```

### Run tests:

```bash
npm run test
```

## Database Migrations

TypeORM is configured with `synchronize: true` in development mode, which automatically syncs the database schema.

For production, you should:

1. Set `synchronize: false`
2. Generate migrations:

```bash
npm run migration:generate -- src/migrations/InitialMigration
```

3. Run migrations:

```bash
npm run migration:run
```

## Environment Variables

| Variable       | Description         | Default               |
| -------------- | ------------------- | --------------------- |
| DB_HOST        | PostgreSQL host     | localhost             |
| DB_PORT        | PostgreSQL port     | 5432                  |
| DB_USERNAME    | Database username   | postgres              |
| DB_PASSWORD    | Database password   | -                     |
| DB_DATABASE    | Database name       | vm_sharing            |
| JWT_SECRET     | JWT secret key      | -                     |
| JWT_EXPIRES_IN | JWT expiration time | 24h                   |
| PORT           | Application port    | 3000                  |
| NODE_ENV       | Environment         | development           |
| API_URL        | API base URL        | http://localhost:3000 |
| CORS_ORIGIN    | Allowed CORS origin | http://localhost:3001 |

## Project Structure

```
src/
├── auth/              # Authentication module
├── calculator/        # Resource calculator
├── config/            # Configuration files
├── entities/          # TypeORM entities
├── jobs/              # Job execution module
├── metrics/           # Usage metrics module
├── rentals/           # Rental management module
├── users/             # User management module
├── virtual-machines/  # VM management module
├── app.module.ts      # Root module
└── main.ts            # Application entry point
```

## Security Features

- Password hashing with bcrypt (10 salt rounds)
- JWT token authentication
- Input validation on all endpoints
- CORS configuration
- Rate limiting (recommended for production)
- Secure token generation for VM connections

## Future Enhancements

- Real payment integration (Stripe, PayPal)
- WebSocket support for real-time updates
- Advanced monitoring dashboards
- VM performance benchmarking
- Automated VM provisioning
- Multi-region support
- Load balancing for VMs

## License

MIT

## Contributors

HackTUES 12 Team
