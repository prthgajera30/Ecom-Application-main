# Recommendations Service (Optional)

The Python recommendations service is not required for local development. The monorepo setup scripts skip it by default so `pnpm run dev` only starts the API and web apps.

If you want to experiment with the service:

1. Create and activate a Python 3.11 virtual environment.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the development server:
   ```bash
   flask --app app.py run --host=0.0.0.0 --port=5000
   ```

Update `RECS_URL` in your environment files if you run the service on a different host or port.
