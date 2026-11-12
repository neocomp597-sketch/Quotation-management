# User Activity API

Shows when each user was created and last modified. Results cover the selected branch of the logged-in user's company.

**Page:** `/admin/user-activity` (Admin → User Activity). Live: `https://arcrm.co.in/admin/user-activity`

**Base URL:** `http://localhost:4003/api` locally. For live, use the live API address followed by `/api`.

## Access

| Header | Value |
|---|---|
| `Authorization` | `Bearer <access token>`, from `POST /api/auth/login` |
| `x-active-branch` | Optional branch id. The app sends the branch selected at the top of the screen. Without it, the server uses the branch saved on the user. |

The user needs the **User Activity** view permission (`admin_user_activity`).

To try these requests in Postman, import `User_Activity_API.postman_collection.json`. Its description explains the steps.

## Endpoints

| Method | URL | Returns |
|---|---|---|
| GET | `/users/activity` | One page of users, as JSON |
| GET | `/users/activity/export` | Every matching user, as an Excel file |
| GET | `/users/activity/:id` | One user, as JSON |

## GET /users/activity

| Parameter | Values | Default |
|---|---|---|
| `search` | Text to match in name or email | None |
| `sortBy` | `name`, `createdAt`, `modifiedAt` | `modifiedAt` |
| `order` | `asc`, `desc` | `desc` |
| `page` | Page number | `1` |
| `limit` | 1 to 200 | `20` |

```bash
curl "http://localhost:4003/api/users/activity?search=admin&sortBy=createdAt&order=desc&page=1&limit=20" \
  -H "Authorization: Bearer <access token>" \
  -H "x-active-branch: <branch id>"
```

Response:

```json
{
  "data": [
    {
      "_id": "665f1c2e8a1b2c3d4e5f6a7b",
      "name": "Asha Patil",
      "email": "asha.patil@example.com",
      "role": "sales",
      "branch": "USGOAN",
      "isActive": true,
      "createdAt": "2026-01-01T04:30:00.000Z",
      "modifiedAt": "2026-10-02T09:05:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
}
```

`branch` is an empty string when the user has no branch. `modifiedAt` is `null` when no change was ever recorded.

## GET /users/activity/export

Takes `search`, `sortBy` and `order` as above. There is no paging: the file holds every matching user.

```bash
curl "http://localhost:4003/api/users/activity/export?sortBy=name&order=asc" \
  -H "Authorization: Bearer <access token>" \
  -H "x-active-branch: <branch id>" \
  -o User_Activity.xlsx
```

Response headers:

| Header | Value |
|---|---|
| `Content-Type` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| `Content-Disposition` | `attachment; filename="User_Activity_YYYYMMDD.xlsx"`, with the date in India time |
| `X-Total-Count` | Number of users in the file. `0` means the file has only the heading row. |

The sheet is named `User Activity`. Its columns are Name, Email, Role, Branch, Status, Created On and Last Modified.

- **Dates:** text in India time, such as `05.NOV.26, 10:30 AM`.
- **Last Modified:** shows `No change recorded` when there is no date.
- **Branch:** shows `-` when the user has no branch.

## GET /users/activity/:id

Returns one user object with the same fields as a `data` entry above, without `data` or `pagination`.

## Errors

Errors are JSON with a `message`.

| Status | Meaning |
|---|---|
| 400 | `:id` is not a valid user id |
| 401 | Token is missing, invalid or revoked |
| 403 | The user does not have the required access |
| 404 | User not found in this company and branch |
| 500 | Server error |

## PDF

There is no PDF API. The Download PDF button reads every matching user from `GET /users/activity`, 200 at a time, and builds the file in the browser.

## Source files

| Purpose | File |
|---|---|
| Routes | `backend/routes/userRoutes.js` |
| API logic | `backend/controllers/userController.js` (`getUserActivity`, `exportUserActivity`, `getUserActivityById`) |
| Permission rule | `backend/config/apiPermissions.js` |
| Frontend API calls | `frontend/src/services/api.js` (`userService.getActivity`, `userService.exportActivity`) |
| Page | `frontend/src/pages/UserActivity.jsx` |
| PDF builder | `frontend/src/utils/userActivityPdf.js` |
