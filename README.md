# RapidRepo - Multi-Tenant SaaS Platform

A modern multi-tenant SaaS platform built with Node.js, Express, React, and MongoDB.

## Features

- 🔐 Multi-tenant authentication system
- 👑 Super Admin Panel
- 🏢 Tenant management
- 🔒 Role-based access control
- 📧 Email notifications
- 🎨 Modern UI with React

## Project Structure

```
rapidrepo/
├── server/                 # Backend API
│   ├── config/            # Database and app configuration
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Custom middleware
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   └── utils/            # Utility functions
├── client/               # Frontend React app
│   ├── public/           # Static files
│   ├── src/              # React components
│   └── package.json      # Frontend dependencies
├── package.json          # Backend dependencies
└── README.md            # This file
```

## Quick Start

1. **Install dependencies:**
   ```bash
   npm run install-all
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   PORT=5000
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

### Seeding Subscription Plans

The system uses a three-tier subscription model: Basic, Premium, and Enterprise. Before running the application for the first time, seed the default subscription plans.

Run the seed script: `npm run seed:plans`. This will create or update the three default plans with predefined pricing and features. The script is idempotent - safe to run multiple times.

Available commands:
- `npm run seed:plans` - Seed or update plans
- `npm run seed:plans:force` - Delete existing plans and reseed (use with caution)
- `npm run seed:plans:dry-run` - Preview changes without modifying database

| Plan      | Max Users | Monthly Price | Key Features |
|-----------|-----------|---------------|--------------|
| Basic     | 10        | ₹350          | Basic search functionality, Up to 10 users, Email support, Mobile app access, Data export (CSV), Basic reporting |
| Premium   | 50        | ₹700          | Advanced search with filters, Up to 50 users, Priority email support, Mobile app access, Bulk operations, Data export (CSV, Excel, JSON), Advanced reporting & analytics, API access, Custom field mapping, Data validation rules |
| Enterprise| Unlimited | ₹1400         | All Premium features, Unlimited users, Dedicated account manager, 24/7 phone & email support, Unlimited bulk operations, All export formats, Custom integrations, White-label options, Advanced security features, SLA guarantee, Custom training, Priority feature requests |

To customize plan pricing or features, edit `server/scripts/seedPlans.js` and re-run the seed script. Plans are referenced by their `code` field (basic/premium/enterprise) throughout the system.

## Subscription & Usage Management

### Usage Tracking & Limits

**Overview:**
The system tracks data downloads and API calls against subscription plan limits. Each plan (Basic, Premium, Enterprise) has defined limits for monthly data downloads and API calls. Usage is tracked per user (repo agent or office staff) and reset monthly.

**Plan Limits:**
- **Basic Plan:** 100 data downloads/month, 1000 API calls/month
- **Premium Plan:** 500 data downloads/month, 5000 API calls/month
- **Enterprise Plan:** Unlimited downloads and API calls

**Usage Tracking:**
- Data downloads are counted per record (e.g., downloading 1000 vehicle records = 1000 downloads)
- API calls are counted per request to tracked endpoints
- Usage counters reset automatically at the start of each billing period
- Usage history is logged for analytics and auditing

**Limit Enforcement:**
- Bulk download endpoints check limits before processing requests
- If limit is exceeded, request is rejected with 429 status code
- Users receive detailed error messages showing current usage, limit, and remaining quota
- Alerts are triggered at 80% and 90% of limit (logged for admin review)

**Tracked Endpoints:**
- `/api/bulk-download/bulk-data` - Full bulk download
- `/api/bulk-download/bulk-chunked` - Chunked download
- `/api/bulk-download/simple-dump` - Simple dump for mobile
- `/api/bulk-download/new-records` - Incremental sync
- `/api/bulk-download/by-ids` - Fetch by IDs
- `/api/bulk-download/bulk-ids` - List IDs only
- `/api/tenants/data/two-wheeler` - Two-wheeler data export
- `/api/tenants/data/four-wheeler` - Four-wheeler data export
- `/api/tenants/data/cv` - Commercial vehicle data export

**Usage Statistics:**
- View current usage: GET `/api/subscriptions/usage` (future endpoint)
- Usage stats include: current count, limit, remaining, percentage, days until reset
- Usage history available for analytics and reporting

**Unlimited Plans:**
- Enterprise plan has unlimited downloads and API calls (limit = -1)
- No enforcement for unlimited plans
- Usage is still tracked for analytics

**Grace Period:**
- Users in grace period retain access to data downloads
- Usage limits are still enforced during grace period
- Alerts are sent if limits are approached

**Technical Details:**
- Usage counters stored in UserSubscription model: `dataDownloaded`, `apiCallsCount`
- Atomic updates using MongoDB `$inc` operator prevent race conditions
- Usage history logged to UsageHistory collection for analytics
- Middleware: `enforceDataDownloadLimit`, `trackDataDownload`, `trackAPICall`
- Utility: `server/utils/usageTracker.js` provides core tracking functions

**Future Enhancements:**
- Email/push notifications when approaching limits
- Self-service usage dashboard in mobile app and web admin
- Configurable alert thresholds per tenant
- Usage-based billing and overage charges

## Database Models

### SubscriptionPlan

The SubscriptionPlan model defines available subscription tiers with pricing, features, and limits.

**Key Fields:**
- `name`: Human-readable plan name (e.g., 'Basic Plan')
- `code`: Machine-readable identifier (e.g., 'basic') - unique and used for references
- `description`: Detailed description of the plan
- `pricing`: Embedded object with pricing for weekly, monthly, quarterly, yearly cycles
- `features`: Array of strings listing included features
- `limits`: Embedded object with maxUsers, maxDataDownloads, maxAPIcalls
- `isActive`: Boolean flag to enable/disable plan
- `displayOrder`: Number for UI sorting and upgrade path logic
- `metadata`: Flexible object for additional data

**Instance Methods:**
- `compareWith(otherPlan)`: Returns comparison object with pricing, features, and limits differences
- `canUpgradeTo(targetPlan)`: Checks if upgrade is possible based on displayOrder
- `canDowngradeTo(targetPlan)`: Checks if downgrade is possible based on displayOrder
- `getUpgradePath()`: Returns list of plans that can be upgraded to
- `getDowngradePath()`: Returns list of plans that can be downgraded to
- `isUnlimited(limitType)`: Checks if a specific limit is unlimited (-1)
- `getPriceForPeriod(period)`: Returns price for a specific billing period

**Static Methods:**
- `getActivePlans()`: Returns all active plans sorted by displayOrder
- `findByCode(code)`: Finds plan by code
- `getDefaultPlan()`: Returns the default plan (displayOrder = 1)

**Virtual Fields:**
- `isBasic`, `isPremium`, `isEnterprise`: Boolean getters for plan type

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Super Admin
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users` - Create new user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user

## Technologies Used

- **Backend:** Node.js, Express.js, MongoDB, Mongoose
- **Frontend:** React.js, Material-UI
- **Authentication:** JWT, bcryptjs
- **Email:** Nodemailer
- **Security:** Helmet, CORS, Rate limiting

## License

MIT License