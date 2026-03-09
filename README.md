![Next.js](https://img.shields.io/badge/Next.js-15-black)
![React](https://img.shields.io/badge/React-19-blue)
![Tailwind](https://img.shields.io/badge/TailwindCSS-38BDF8)
# Zeo Matrix

> **Connect with family and friends. Share your world — securely.**

 **Live Demo:**  
https://zeomatrix.vercel.app

---

## About

**Zeo Matrix** is a modern social platform that enables users to:

- Share posts  
- Connect with other users  
- Engage with content through likes and comments  
- Send private messages  
- Maintain customizable profiles  

The platform focuses on **clean design, secure authentication, and smooth user experience** across all devices.

---

## Features

### Authentication
- Secure **Sign Up**
- **Login**
- **Sign Out**
- Protected routes and authenticated actions

### Social Interaction
- Create **text posts**
- Optional **image attachments**
- **Like posts**
- **Comment on posts**
- **Reply to comments**

### Connections
- **Follow** other users
- **Unfollow** users
- Personalized **feed from followed users**

### Messaging
- **Direct messaging** between users

### Profiles
- Custom **profile picture**
- **Cover image**
- Personal **bio**

### UI / UX
- **Responsive design** (Desktop, Tablet, Mobile)
- **Infinite scrolling feed**
- Clean modern UI

---

## Tech Stack

| Category | Technology |
|--------|--------|
| **Frontend** | Next.js (App Router) + React |
| **Styling** | Tailwind CSS |
| **Authentication** | NextAuth.js |
| **Backend / ORM** | Prisma |
| **Database** | PostgreSQL |
| **Forms & Validation** | React Hook Form + Zod |
| **Data Fetching** | TanStack Query / SWR |
| **Realtime** | WebSockets / Supabase Realtime |
| **Deployment** | Vercel |

---

## Quick Start (Local Development)

### 1️Clone the repository

```bash
git clone [https://github.com/TayyabSaleem7868/zeo-matrix.git] (https://github.com/TayyabSaleem7868/zeo-matrix.git)
cd zeo-matrix
```

---

### Install dependencies

Choose your package manager:

```bash
npm install
```

or

```bash
yarn install
```

or

```bash
pnpm install
```

or

```bash
bun install
```

---

### Setup environment variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and provide the required values such as:

- Database connection string
- Authentication secrets
- API keys

---

### Run the development server

```bash
npm run dev
```

Open in your browser:

```
https://localhost:8080
```

 **Note:**  
A running database and configured authentication provider are required for features like:

- Signup
- Posting
- Following users
- Messaging
- Likes and comments

---

## Deployment (Vercel)

Deploying Zeo Matrix is simple using **Vercel**.

### Steps

1. Push your code to **GitHub**
2. Visit:

```
https://vercel.com/new
```

3. Import your repository
4. Add environment variables from `.env.local`
5. Click **Deploy**

Vercel automatically provides:

- Preview deployments
- Continuous integration
- Custom domains
- Automatic builds

---

## Author

**Raja Tayyab Saleem**

If you like the project, consider ⭐ **starring the repository**!

---
