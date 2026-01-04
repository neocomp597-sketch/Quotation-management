# Deployment Guide (Render.com)

It looks like you are trying to deploy to **Render**. The error you are seeing (`npm error enoent Could not read package.json`) happens because your project is in a subdirectory (`backend`), but Render is looking for it in the main root.

Here is how to deploy correctly on Render:

## 1. Deploying the Backend (Web Service)
1.  Create a **New Web Service** on Render.
2.  Connect your GitHub repository.
3.  **Crucial Step:** In the settings, find **Root Directory**.
    *   Set this to: `backend`
4.  **Configure Commands:**
    *   **Build Command:** `npm install`
    *   **Start Command:** `npm start`
5.  **Environment Variables:** Add keys:
    *   `MONGO_URI`: (Your MongoDB Atlas Connection String)
    *   `JWT_SECRET`: (Your secret key)
    *   `PORT`: `10000` (Render creates this automatically, but good to know)
6.  Click **Create Web Service**.
    *   *Note URL:* e.g., `https://quotations-backend.onrender.com`

---

## 2. Deploying the Frontend (Static Site)
1.  Create a **New Static Site** on Render.
2.  Connect the same repository.
3.  **Crucial Step:** In the settings, find **Root Directory**.
    *   Set this to: `frontend`
4.  **Configure Commands:**
    *   **Build Command:** `npm install && npm run build`
    *   **Publish Directory:** `dist`
5.  **Environment Variables:**
    *   `VITE_API_URL`: The URL from Step 1, with `/api` at the end (e.g., `https://quotations-backend.onrender.com/api`).
6.  **Rewrite Rules (Important for React Router):**
    *   Go to "Redirects/Rewrites" tab.
    *   Add a rule:
        *   **Source:** `/*`
        *   **Destination:** `/index.html`
        *   **Action:** `Rewrite`
7.  Click **Create Static Site**.

---

### Why did it fail before?
Render defaults to looking for `package.json` in the top folder. Since your code is organized into `frontend/` and `backend/` folders, you **must** specify the "Root Directory" for Render to find the correct files.
