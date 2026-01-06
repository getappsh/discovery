# Pending Versions Feature

## Overview

This feature handles scenarios where devices report installed components with versions that don't exist on the server. When a device reports a component that starts with an ID of zero, it could mean:

1. Agent hasn't synced the project identifier with the offering that server will send (Agent will resolve this)
2. **Project does not exist** (handled by this feature)
3. **Version does not exist** (handled by this feature)

This implementation focuses on scenarios 2 and 3, providing a system to track, review, and accept/reject unknown versions reported by devices.

## Architecture

### Database Schema

**Table: `pending_version`**

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key |
| project_name | string | Name of the project |
| version | string | Version number |
| catalog_id | string | Catalog ID (optional) |
| status | enum | PENDING, ACCEPTED, or REJECTED |
| reported_count | integer | Number of times this version was reported |
| first_reported_date | timestamp | When first reported |
| last_reported_date | timestamp | When last reported |
| reporting_device_ids | jsonb | Array of device IDs that reported this version |
| metadata | jsonb | Additional metadata |
| reason | string | Reason for acceptance/rejection |
| created_date | timestamp | Record creation date |
| last_updated_date | timestamp | Record update date |

**Unique Constraint:** (project_name, version)

### Components Created

1. **Entity**: `PendingVersionEntity` - Database entity for storing unknown versions
2. **DTOs**: 
   - `PendingVersionDto` - Version information response
   - `PendingVersionListDto` - Paginated list response
   - `AcceptPendingVersionDto` - Accept version request
   - `RejectPendingVersionDto` - Reject version request
   - `CreateProjectVersionDto` - Kafka message for creating project/version
3. **Service**: `PendingVersionService` - Business logic for managing pending versions
4. **Controller**: `PendingVersionController` - REST API endpoints
5. **Kafka Topic**: `getapp-offering.create-pending-project-version` - For creating projects/versions

## API Endpoints

### 1. List Pending Versions

**GET** `/pending-versions`

Query Parameters:
- `status` (optional): Filter by status (PENDING, ACCEPTED, REJECTED)
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "versions": [
    {
      "id": 1,
      "projectName": "my-app",
      "version": "1.2.3",
      "catalogId": "my-app@1.2.3",
      "status": "PENDING",
      "reportedCount": 3,
      "firstReportedDate": "2026-01-01T10:00:00Z",
      "lastReportedDate": "2026-01-05T15:30:00Z",
      "reportingDeviceIds": ["device-001", "device-002", "device-003"],
      "metadata": {},
      "reason": null
    }
  ],
  "total": 1
}
```

### 2. Accept Pending Version

**POST** `/pending-versions/accept`

**Request Body:**
```json
{
  "projectName": "my-app",
  "version": "1.2.3",
  "isDraft": true,
  "reason": "Approved for testing"
}
```

**Response:**
```json
{
  "message": "Version my-app@1.2.3 accepted and will be created"
}
```

**Behavior:**
- Updates the pending version status to `ACCEPTED`
- Emits a Kafka event to the offering service to create the project (if missing) and version
- The `isDraft` flag determines if the created version will be in draft status

### 3. Reject Pending Version

**POST** `/pending-versions/reject`

**Request Body:**
```json
{
  "projectName": "my-app",
  "version": "1.2.3",
  "reason": "Invalid version number"
}
```

**Response:**
```json
{
  "message": "Version my-app@1.2.3 rejected"
}
```

**Behavior:**
- Updates the pending version status to `REJECTED`
- Keeps the record for audit purposes (does not delete)

## How It Works

### Detection Flow

1. **Device reports components** via discovery message
2. **DiscoveryService.setCompsOnDeviceV2()** processes the components:
   - Queries the database for all reported catalog IDs
   - Identifies components that don't exist in the database
   - **Skips** catalog IDs starting with "0." (scenario 1 - agent sync issue)
   - For unknown versions, extracts project name and version
   - **Calls** `PendingVersionService.recordPendingVersion()` asynchronously

3. **PendingVersionService** handles the recording:
   - Checks if version is already in the pending table
   - If exists: updates `reportedCount`, adds device to `reportingDeviceIds`, updates `lastReportedDate`
   - If new: creates new record with `PENDING` status

### Acceptance Flow

1. **User reviews** pending versions via GET endpoint
2. **User accepts** version via POST endpoint
3. **Service updates** status to `ACCEPTED`
4. **Kafka event emitted** to `getapp-offering.create-pending-project-version` topic
5. **Offering service** (separate microservice) receives event and:
   - Creates project if it doesn't exist
   - Creates version with specified draft status
   - Links version to project

### Rejection Flow

1. **User reviews** pending versions
2. **User rejects** version via POST endpoint
3. **Service updates** status to `REJECTED`
4. **Record kept** for audit trail

## Microservice Communication

This feature follows the microservice architecture pattern by not directly accessing tables that belong to other services. Instead, it uses Kafka for inter-service communication.

**Topic:** `getapp-offering.create-pending-project-version`

**Message Format:**
```typescript
{
  projectName: string;
  version: string;
  isDraft: boolean;
  reason?: string;
}
```

**Note:** The offering service needs to implement a handler for this topic to actually create the projects and versions.

## Best Practices Implemented

1. **Separation of Concerns**: Each component has a single responsibility
2. **Async Processing**: Unknown version recording doesn't block the discovery flow
3. **Error Handling**: Comprehensive error logging and graceful degradation
4. **Data Integrity**: Unique constraints prevent duplicates
5. **Audit Trail**: Rejected versions are kept for historical tracking
6. **Microservice Pattern**: Uses Kafka for cross-service communication
7. **Idempotency**: Multiple reports of the same version are aggregated
8. **Type Safety**: Strong typing with TypeScript and DTOs
9. **Validation**: Input validation using class-validator decorators
10. **Logging**: Comprehensive logging at each step

## Database Migration

To apply this feature, you need to create the `pending_version` table. Here's the migration SQL:

```sql
CREATE TYPE pending_version_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE pending_version (
  id SERIAL PRIMARY KEY,
  project_name VARCHAR NOT NULL,
  version VARCHAR NOT NULL,
  catalog_id VARCHAR,
  status pending_version_status NOT NULL DEFAULT 'PENDING',
  reported_count INTEGER NOT NULL DEFAULT 1,
  first_reported_date TIMESTAMPTZ NOT NULL,
  last_reported_date TIMESTAMPTZ NOT NULL,
  reporting_device_ids JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  reason VARCHAR,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_project_version UNIQUE (project_name, version)
);

CREATE INDEX idx_pending_version_status ON pending_version(status);
CREATE INDEX idx_pending_version_last_reported ON pending_version(last_reported_date DESC);
```

## Usage Example

### Scenario: Device reports unknown version

```bash
# Device sends discovery message with component "my-app@2.0.0"
# System automatically detects it's not in database
# Creates pending version entry

# 1. Review pending versions
curl -X GET "http://localhost:3000/pending-versions?status=PENDING"

# 2. Accept a version
curl -X POST "http://localhost:3000/pending-versions/accept" \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "my-app",
    "version": "2.0.0",
    "isDraft": true,
    "reason": "Approved for testing by QA team"
  }'

# 3. Or reject a version
curl -X POST "http://localhost:3000/pending-versions/reject" \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "old-app",
    "version": "0.0.1",
    "reason": "Deprecated version, no longer supported"
  }'
```

## Files Modified/Created

### Created Files:
- `discovery/libs/common/src/database/entities/pending-version.entity.ts`
- `discovery/libs/common/src/dto/discovery/dto/pending-version.dto.ts`
- `discovery/apps/discovery/src/pending-version/pending-version.service.ts`
- `discovery/apps/discovery/src/pending-version/pending-version.controller.ts`

### Modified Files:
- `discovery/libs/common/src/database/entities/index.ts` - Added export for PendingVersionEntity
- `discovery/libs/common/src/dto/discovery/index.ts` - Added export for pending version DTOs
- `discovery/libs/common/src/microservice-client/topics/topics.enums.ts` - Added Kafka topic
- `discovery/apps/discovery/src/discovery/discovery.service.ts` - Added unknown version detection logic
- `discovery/apps/discovery/src/discovery.module.ts` - Registered new services and controller

## Next Steps

1. **Run Database Migration**: Apply the SQL migration to create the table
2. **Implement Offering Service Handler**: Create a Kafka consumer in the offering service to handle the `CREATE_PENDING_PROJECT_VERSION` event
3. **Add Authentication/Authorization**: Secure the API endpoints with appropriate role-based access
4. **Add Frontend UI**: Create admin interface for reviewing and managing pending versions
5. **Add Notifications**: Notify admins when new pending versions are detected
6. **Add Bulk Operations**: Allow accepting/rejecting multiple versions at once

## Testing Recommendations

1. **Unit Tests**: Test service methods in isolation
2. **Integration Tests**: Test the full flow from device discovery to pending version creation
3. **E2E Tests**: Test the API endpoints
4. **Load Tests**: Ensure the system handles multiple devices reporting simultaneously

## Monitoring

Add monitoring for:
- Number of pending versions over time
- Acceptance/rejection rates
- Time to resolution (first report to acceptance/rejection)
- Devices reporting unknown versions
