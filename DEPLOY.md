# Deployment Guide (Vercel)

This application is configured to be deployed as two separate projects on Vercel: one for the Frontend and one for the Backend.

### ⚠️ Critical Notice: Image Uploads
Vercel is a **Serverless Platform** with an ephemeral file system. This means **files uploaded to the disk (like product images) will be deleted immediately** after the request finishes.
*   **Current State:** Image uploads work locally because they save to your computer's disk.
*   **On Vercel:** You will be able to upload, but images will **break/disappear** instantly.
*   **Solution:** For a production app, you must update the backend to upload to a cloud service like **Cloudinary** or **AWS S3**.

---

## 1. Deploying the Backend
1.  Push your code to GitHub/GitLab.
2.  Go to Vercel and **Add New Project**.
3.  Import your repository.
4.  **Configure Project**:
    *   **Root Directory**: Click "Edit" and select `backend`.
    *   **Framework Preset**: Other (default is fine).
    *   **Environment Variables**: Add the following:
        *   `MONGO_URI`: Your MongoDB Connection String (from Atlas).
        *   `JWT_SECRET`: A secure random string for authentication.
5.  Click **Deploy**.
6.  **Copy the Domain**: Once deployed, copy the URL (e.g., `https://quotations-backend.vercel.app`).

## 2. Deploying the Frontend
1.  Go to Vercel and **Add New Project** (using the same repo).
2.  **Configure Project**:
    *   **Root Directory**: Click "Edit" and select `frontend`.
    *   **Framework Preset**: Vite (should be auto-detected).
    *   **Environment Variables**: Add the following:
        *   `VITE_API_URL`: The Backend URL you copied in Step 1, appended with `/api`.
            *   *Example*: `https://quotations-backend.vercel.app/api`
3.  Click **Deploy**.

## 3. Final Verification
*   Open your deployed Frontend URL.
*   Login and verify data is loading from MongoDB.
*   **Reminder**: Do not test image uploads on Vercel; they will fail. Use pure URLs for products instead.
