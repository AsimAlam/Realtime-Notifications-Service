# Realtime Notification

A production-ready example demonstrating a real-time notifications & presence service using STOMP-over-WebSocket (SockJS) and a small React UI.Backend is Spring Boot (Java) with Postgres + Redis, frontend is Vite + React. This repo is intended for a strong portfolio / resume project: it shows real-time design, delivery ACKs, persistence, presence, and deployment.

## Key Features

- STOMP over WebSocket (SockJS) for realtime messaging
- REST endpoint to enqueue notifications (```/notify```)
- Persistent storage of notifications (Postgres)
- Presence tracking (Redis-backed sets; in-memory fallback)
- Delivery ACKs and delivery-confirm messages (sender notified when message delivered)
- Message recovery for missed messages (```/app/recover```)
- Small React SPA to demo: get token, connect, send private/broadcast messages, show presence

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen.svg)](https://realtime-notifications-service.onrender.com)

![notification-service-pic1](https://github.com/user-attachments/assets/780cc179-dcb6-4125-8fbe-db563666f184)

![notification-service-pic2](https://github.com/user-attachments/assets/47c466a4-9e1a-48d2-917e-7f07845e691d)

## If You Like This Project...

If you find this project useful, please give it a star on GitHub! Your support helps improve the project and encourages further development.

## Tech Stack

- **Backend:**  Java 17, Spring Boot, Spring WebSocket (STOMP), Spring Data JPA, Spring Data Redis (Lettuce)
- **Database:** PostgreSQL
- **Cache / presence:** Redis (or Key-Value service)
- **Frontend:** React (Vite), SockJS, ```@stomp/stompjs```, Axios

## Architecture (brief)

- Client requests a dev token (```GET /auth/token?username=...```) and connects to ```/ws?token=...``` via SockJS.
- Backend authenticates the token and maps the session to a username (STOMP user destinations).
- When a message arrives (STOMP ```/app/send``` or REST ```/notify```), backend persists it to Postgres and attempts real-time delivery:
    - If recipient connected → server sends to ```/user/queue/notifications```.
    - Recipient should publish an ACK (```/app/ack```) which marks DB record delivered and optionally notifies original sender on ```/user/queue/delivery-confirm```.
- Presence stored in Redis sets (per-user sessions + global set), with optional polling or subscription to ```/topic/presence```.

## Setup Instructions

### Prerequisites

- Java 17
- Maven (or use ```./mvnw```)
- Node 16+
- Docker for Postgres/Redis

### Backend Setup

1. **Copy ```.env.example``` → ```.env``` and fill values (do not commit ```.env```):**

   ```bash
   SPRING_PROFILES_ACTIVE=dev
   SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/realtime
   SPRING_DATASOURCE_USERNAME=postgres
   SPRING_DATASOURCE_PASSWORD=postgres
   SPRING_REDIS_URL=redis://localhost:6379
   JWT_SECRET=replace-with-secure-value

   ```
2. **Run DB + Redis locally (docker):**
      
   ```bash
   docker run --name rt-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=realtime -p 5432:5432 -d postgres:15
   docker run --name rt-redis -p 6379:6379 -d redis:7

   ```
3. **Build & run backend:**
   
   ```bash
   # from backend/
   ./mvnw clean package -DskipTests
   java -Dspring.profiles.active=dev \
         -Dspring.redis.url=redis://localhost:6379 \
         -Dspring.datasource.url=jdbc:postgresql://localhost:5432/realtime \
         -Dspring.datasource.username=postgres \
         -Dspring.datasource.password=postgres \
         -jar target/*.jar
   
   ```
4. **Check health:**

   ```bash
   curl http://localhost:8080/actuator/health

   ```

   
### Frontend Setup

1. **Copy ```.env.exampl```e → ```.env``` and set:**

   ```bash
   VITE_API_BASE=http://localhost:8080
   
   ```
2. **Install & run:**

   ```bash
   cd frontend
   npm ci
   npm run dev
   # open http://localhost:5173

   ```
      
2. **Use the UI: Get Token → Connect → Send messages.**

## API & STOMP reference

### HTTP
- ```GET /auth/token?username={name}``` – (dev token for demo) returns ```{ token: "..." }```.
- ```POST /notify``` – body ```{ userId, message }``` (enqueue + attempt deliver).
- ```GET /actuator/health``` – health.

### STOMP destinations
- ```SUBSCRIBE /user/queue/notifications``` – notifications for the connected user.
- ```SUBSCRIBE /user/queue/delivery-confirm``` – delivery confirmations for senders.
- ```SEND /app/send``` – payload ```{ toUserId, content }``` (private send).
- ```SEND /app/ack``` – ack payload ```{ notificationId, seq, toUserId }```.
- ```SEND /app/recover``` – ```{ lastSeenSeq }``` to request missed messages.

SockJS endpoint: ```/ws``` (connect with token either in query ```?token=...``` or ```Authorization``` header).

### Environment variables (```.env.example```)

Keep only ```.env.example``` in repo. Example:

```bash
# .env.example — placeholders ONLY
SPRING_PROFILES_ACTIVE=dev

SPRING_DATASOURCE_URL=jdbc:postgresql://<HOST>:5432/<DB>
SPRING_DATASOURCE_USERNAME=<DB_USER>
SPRING_DATASOURCE_PASSWORD=<DB_PASS>

SPRING_REDIS_URL=redis://<HOST>:6379

JWT_SECRET=REPLACE_WITH_STRONG_SECRET

# Frontend:
VITE_API_BASE=http://localhost:8080

```

### Docker Compose (local dev)

Sample ```docker-compose.yml```:

```bash

version: "3.8"
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: realtime
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]

  redis:
    image: redis:7
    ports: ["6379:6379"]

  backend:
    build: ./backend
    depends_on: [db, redis]
    environment:
      - SPRING_PROFILES_ACTIVE=dev
      - SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/realtime
      - SPRING_DATASOURCE_USERNAME=postgres
      - SPRING_DATASOURCE_PASSWORD=postgres
      - SPRING_REDIS_URL=redis://redis:6379
    ports:
      - "8080:8080"

```

Start:

```bash
docker-compose up --build

```

