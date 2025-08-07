# Server-Side Bot Architecture

## Overview

A server-sided bot runs on a web server and provides an API that clients can connect to. This architecture offers several advantages:

1. **Centralized Control**: One server manages all accounts
2. **Always Running**: No need to keep local terminals open
3. **Remote Access**: Control from anywhere via web interface or API
4. **Shared State**: Can coordinate between multiple accounts
5. **Potential Benefits**: If you get special API access, all users benefit

## Architecture Components

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Your Server │────▶│ Gigaverse   │
│ (Browser/   │     │   (Express)  │     │    API      │
│   CLI)      │◀────│              │◀────│             │
└─────────────┘     └──────────────┘     └─────────────┘
```

## Implementation Options

### 1. Simple Web API (Express.js)
- Create REST endpoints for bot actions
- Store JWT tokens securely
- Manage bot instances per account

### 2. WebSocket Server
- Real-time updates to clients
- Live game state streaming
- Interactive control

### 3. Queue-Based System
- Redis/RabbitMQ for job scheduling
- Background workers for each account
- Scalable architecture

## Key Considerations

1. **Security**: Never expose JWT tokens to clients
2. **Rate Limiting**: Respect Gigaverse API limits
3. **Error Handling**: Graceful failures and retries
4. **Monitoring**: Track bot performance and errors
5. **Authentication**: Secure your API endpoints