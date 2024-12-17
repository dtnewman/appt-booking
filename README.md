# Booking Assistant

This is a sample application for a booking assistant. It is built with Next.js, OpenAI, and shadcn.

## How to use

1. Clone the repository
2. Run `npm install` to install dependencies
3. Create a `.env` file in the root directory with the following variables (see .env.example for more details)
```env
DATABASE_URL=your_database_url
OPENAI_API_KEY=your_openai_key
RESEND_API_KEY=your_resend_key
```

4. Run `npx prisma generate` to generate the Prisma client
5. Run `npx prisma migrate deploy` to apply existing migrations
6. Run `npm run db:seed` to seed the database
7. Run `npm run dev` to run the development server



## Docker Setup

You can also run this application using Docker. Here's how:

### Prerequisites

- Docker installed on your machine

### Using Docker

1. Create a `.env` file with your environment variables (see .env.example for more details)

2. Build the Docker image:
```bash
docker build -t booking-app .
```

2. Run the container:
```bash
docker run -p 3000:3000 booking-app
```

The application will be available at `http://localhost:3000`.
