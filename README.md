📄 HeArtSpace — Backend Documentation (Report-Style README)
1. Introduction

The backend component of HeArtSpace provides secure APIs that enable content delivery, user management, emotional healing modules, and digital community engagement.

It is built using Node.js with Express and integrated with PostgreSQL (via Prisma ORM) to ensure consistency, scalability, and low operational cost.

2. Objectives and Scope

The backend system is designed to:

Authenticate and authorize users

Serve whitelisted endpoints to the frontend

Store, retrieve, and update user progress

Manage multimedia content

Ensure secure uploads and interactions

The backend follows RESTful architecture to promote clarity and future scalability.

3. System Architecture Overview
3.1 Core Stack
Component	Technology
Server	Node.js + Express
Database	PostgreSQL (Neon)
ORM	Prisma
Storage	Cloudinary
Auth	JWT

The application uses middleware-based request evaluation, ensuring modularity and security.

4. Database Structure (Conceptual Overview)

The relational schema includes:

User: core identity data

Program/Module: educational / healing units

Post: community communication

Artwork & Comments: art engagement

Session: user participation

Constraints, foreign keys, and deletion policies align with relational integrity best practices.

5. Installation and Setup
5.1 Prerequisites

Node.js v18+

PostgreSQL database (Neon recommended)

Cloudinary credentials

5.2 Setup Steps

Clone repository:

git clone https://github.com/your-backend-repo.git
cd your-backend-repo


Install dependencies:

npm install


Create .env file:

PORT=5000
DATABASE_URL=postgresql://user:password@host:port/db?schema=public
JWT_SECRET=change_me
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx


Generate database models:

npx prisma generate


Apply migrations:

npx prisma migrate dev


Run server in development:

npm run dev

6. API Design Summary

All endpoints follow /api/* prefixing.

Authentication Endpoints

POST /auth/signup

POST /auth/signin

GET /auth/me

Content Endpoints

/posts (list, create, delete)

/artworks (upload, list, like, comment)

/modules (view programs, program content)

/sessions (discover, enroll)

Authentication is enforced with Bearer <token> headers.

7. Deployment Guidelines

Deploy via Vercel / Railway / Render

Store credentials using environment variables

Enable connection pooling for Postgres

Runtime environment must:

Allow CORS for frontend origin

Disable file logging in production

8. Error Handling and Security
8.1 Error Handling

Centralized middleware handles:

Database errors

Validation errors

Authentication failures

Unexpected exceptions

8.2 Security Considerations

JWT tokens are time-limited

Passwords hashed with bcrypt

File uploads sanitized before storage

CORS policy enforced at server level

9. Limitations

No admin dashboard

Limited role hierarchy (user only)

Horizontal scaling recommended under heavy load

10. Future Enhancements

Add role-based access control (RBAC)

Add analytics + reporting

Implement AI-guided therapy assistants
