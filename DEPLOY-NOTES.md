# reverbed.exe deploy notes

Settings the backend reads (set them on the Cloud Run service):

| variable | what it does | default |
|---|---|---|
| `REVERBED_ACCESS_CODE` | the friends-only passcode. **Required**: with it unset, every request is refused | none |
| `ALLOWED_ORIGINS` | the frontend's URL(s), comma separated | `http://localhost:5173` |
| `IMPORTS_PER_HOUR` | imports + uploads per person per hour | `50` |
| `MAX_TRACK_MINUTES` / `MAX_UPLOAD_MB` | length and size caps | `15` / `50` |
| `TRACK_TTL_MINUTES` | backstop deletion if a tab never says goodbye | `120` |

Cost caps to set when deploying the backend (Cloud Run):

- `--max-instances=1` (the rate limits live in memory, and this caps the worst-case bill)
- `--min-instances=0` (scales to zero, so it costs nothing while idle)
- `--memory=1Gi` (Cloud Run's disk is memory, so tracks count against this)
- `--concurrency=10` and `--timeout=300`
- a billing budget alert (e.g. $5) in the Cloud console

Frontend: put the backend URL in `frontend/.env.production.local` as `VITE_API_URL`, then `npm run build` and host `frontend/dist`.

## Deploys

Pushing to `main` deploys everything automatically: the Cloud Build trigger `deploy-main` runs `cloudbuild.yaml`, which rebuilds and redeploys the backend (Cloud Run `reverbed-api`) and the site (Firebase Hosting). Build history: Cloud Build → History in the `reverbed-exe` project.

The Cloud Run settings (access code, allowed origins, instance caps) live on the service and carry over between deploys.
