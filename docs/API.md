# API Design Guidelines

## REST API Conventions

### Endpoint Structure

```
/api/v1/{resource}/{id}/{sub-resource}

Examples:
GET    /api/v1/users
GET    /api/v1/users/:id
GET    /api/v1/users/:id/projects
POST   /api/v1/users/:id/projects
DELETE /api/v1/users/:id
```

### HTTP Methods

- `GET` - Retrieve resource(s)
- `POST` - Create new resource
- `PUT` - Update entire resource
- `PATCH` - Partial update
- `DELETE` - Delete resource

### Status Codes

- `200 OK` - Successful request
- `201 Created` - Resource created
- `204 No Content` - No response body
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict
- `422 Unprocessable Entity` - Validation failed
- `429 Too Many Requests` - Rate limited
- `500 Internal Server Error` - Server error

## Request/Response Format

### Request

```typescript
interface ApiRequest {
  body: Record<string, unknown>;
  query?: Record<string, string>;
  params?: Record<string, string>;
  headers: Record<string, string>;
  user?: { id: string; email: string };
}
```

### Response

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
  };
}
```

### Example Response

```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "metadata": {
    "timestamp": "2024-06-26T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

## Pagination

### Query Parameters

```
GET /api/v1/users?page=1&limit=20&sort=-createdAt&search=john
```

### Response Format

```typescript
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
```

## Filtering & Sorting

### Query Parameters

```
# Filtering
?status=active
?status=active,pending
?createdAt[gte]=2024-01-01
?createdAt[lte]=2024-12-31

# Sorting
?sort=name
?sort=-createdAt (descending)
?sort=createdAt,-name (multiple)
```

## Error Handling

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "email": "Invalid email format",
      "password": "Password too short"
    }
  }
}
```

### Error Codes

```
AUTHENTICATION_REQUIRED
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
RATE_LIMIT_EXCEEDED
INTERNAL_ERROR
```

## Authentication

### Bearer Token

```
Authorization: Bearer {token}
```

### API Key

```
X-API-Key: {api_key}
```

## Rate Limiting

### Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1234567890
```

## Versioning

- API version in path: `/api/v1/`
- Backward compatibility maintained
- Deprecation warnings in headers

## Naming Conventions

- Resources: plural nouns (users, projects)
- Actions: HTTP methods, not URL verbs
- Query params: camelCase
- Response fields: camelCase
- Timestamps: ISO 8601 format

## Documentation

Each endpoint should document:

- Purpose
- HTTP method and path
- Authentication requirements
- Request body/parameters
- Response format
- Error scenarios
- Example request/response
- Rate limits
