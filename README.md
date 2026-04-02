# Food Backend

This backend provides a simple Express API for the food ordering frontend.

## Install

cd backend
npm install

## Start server

npm start

## Endpoints

- GET `/api/status`
- GET `/api/menu`
- POST `/api/auth/signup`
- POST `/api/auth/login`
- POST `/api/orders`
- GET `/api/orders/:username`

## Data files

- `data/menu.json`
- `data/users.json`
- `data/orders.json`

## MongoDB setup

To use MongoDB instead of JSON files, set the `MONGODB_URI` environment variable and optionally `MONGODB_DB`.

Example:

```bash
cd backend
set MONGODB_URI=mongodb://localhost:27017
set MONGODB_DB=foodApp
npm start
```

If MongoDB is configured, the backend will seed the database from the existing JSON files during startup.

### Using a `.env` file

Create `backend/.env` with:

```
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=foodApp
```

Then start the backend from `backend/`:

```bash
npm start
```
"# food_ai_server" 
"# food_ai_server" 
