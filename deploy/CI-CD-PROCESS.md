# My first CI/CD deployment: Chameleon backend

This document explains the CI/CD process implemented in this repository. It is
based on the checked-in workflow and deployment scripts; it does not record
individual AWS console actions or verify the current state of the live server.

## 1. What we built

We automated testing, building, and deploying the Chameleon backend to a Debian
EC2 instance, with Amazon RDS MySQL as its production database. The frontend
is hosted separately and is not deployed by this workflow.

- **Continuous integration (CI):** check that the backend compiles, passes its
  tests, and has valid deployment scripts.
- **Continuous deployment (CD):** after CI passes on `main`, build and publish
  the Docker images, update the server, and check that the application is healthy.

```text
Code change / pull request
          |
          v
GitHub Actions: checks + tests against temporary MySQL
          |
          | main branch only, after checks pass
          v
Build API image + database migration image
          |
          v
Push both images to Amazon ECR
          |
          v
AWS Systems Manager runs deployment commands on EC2
          |
          v
Pull images -> apply RDS migrations -> start API -> check health
                                                   |
                                  unhealthy? attempt previous release
```

## 2. Files that make it work

| File | Purpose |
| --- | --- |
| [backend-ci-cd.yml](../.github/workflows/backend-ci-cd.yml) | Defines the test, image-build, and deployment jobs. |
| [Dockerfile](../backend/Dockerfile) | Builds separate `runtime` and `migrations` images. |
| [bootstrap-debian.sh](bootstrap-debian.sh) | Prepares EC2 with Docker, AWS CLI, SSM Agent, and the RDS CA bundle. |
| [compose.yml](compose.yml) | Defines production containers, volumes, and optional Caddy HTTPS. |
| [send-deployment.py](send-deployment.py) | Sends deployment configuration to EC2 through SSM and waits for the result. |
| [deploy.sh](../backend/scripts/deploy.sh) | Pulls images, runs migrations, starts containers, and attempts rollback on startup failure. |
| [backend.env.example](backend.env.example) | Template for the production configuration kept on EC2. |
| [iam/](iam/) | Templates for GitHub trust, GitHub deployment permissions, and EC2 image-pull permissions. |
| [README.md](README.md) | Detailed infrastructure setup and maintenance instructions. |

The root `docker-compose.yml` is for local development. Production uses
`deploy/compose.yml` and the existing RDS database.

## 3. One-time infrastructure setup

### Prepare EC2 and RDS

1. Use a Debian 12 or 13 EC2 instance supported by the bootstrap script.
2. Allow EC2 to reach RDS MySQL on port `3306` through private networking and
   security groups. The RDS inbound rule should allow the EC2 security group.
3. Create the application's database and database user, with permissions to
   apply the committed Prisma migrations.
4. Attach an EC2 role with `AmazonSSMManagedInstanceCore` and the ECR pull
   permissions from `iam/ec2-ecr-policy.json`, substituting the account and region.
5. Copy `bootstrap-debian.sh` to EC2 and run `sudo bash bootstrap-debian.sh`.
6. Confirm the instance is online in Systems Manager.

### Configure production settings on EC2

The default production environment file is:

```text
/home/admin/chameleon/backend/.env
```

Use `backend.env.example` as the starting point for a new configuration. Set
`DATABASE_URL`, `JWT_SECRET`, and `CORS_ORIGIN`, plus the ingress settings for
your proxy. Keep the populated file on EC2 with permissions `600`.

The database URL uses the RDS CA bundle mounted at
`/app/certs/global-bundle.pem`. Special characters in database credentials must
be URL-encoded.

For the included Caddy proxy, set `APP_DOMAIN`, enable `COMPOSE_PROFILES=https`,
point the API domain to the instance, and allow ports `80` and `443`. Other
supported arrangements are an existing host proxy or an ALB; see the deployment
README for their settings.

### Prepare ECR and GitHub authentication

Create two ECR repositories:

- `gold-ecr`: the backend API image.
- `gold-ecr-migrations`: the image that runs Prisma database migrations.

The setup guide configures immutable tags and image scanning on push. Keep
previous release images available for rollback.

GitHub Actions authenticates to AWS through **OpenID Connect (OIDC)**. Configure
the GitHub OIDC provider and an IAM deployment role using the templates in
`deploy/iam/`. Match the role's trust subject to the repository's exact
`production` environment subject. The workflow's **Show OIDC trust claims**
step prints the issuer, audience, and subject to help diagnose mismatches.

GitHub uses temporary AWS credentials to push images and send SSM commands.
EC2 uses its own role to pull images. The workflow does not require an SSH key
or long-lived AWS access keys stored in GitHub.

### Configure the GitHub production environment

Create a GitHub environment named `production`, restrict its deployment branches
to `main`, and configure these environment variables:

| Variable | Purpose / workflow default |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | Required ARN of the GitHub deployment role. |
| `AWS_REGION` | EC2/ECR region; defaults to `us-east-1`. |
| `EC2_INSTANCE_ID` | Target instance; the workflow has a project-specific default. |
| `EC2_DOCKER_PLATFORM` | Defaults to `linux/amd64`; use `linux/arm64` for an ARM instance. |
| `BACKEND_ENV_FILE` | Defaults to `/home/admin/chameleon/backend/.env`. |

If you change the instance, update the instance ARN in the GitHub IAM policy too.
Application secrets remain in the EC2 environment file. `BACKEND_ENV_FILE` is
only the path to that file.

## 4. What happens on each deployment

### Step 1: Trigger the workflow

The workflow is called **Backend CI and EC2 deployment**. It runs for pull
requests and pushes to `main` when changes affect `backend/**`, `deploy/**`,
the workflow itself, or `.gitattributes`. It can also be started manually from
GitHub Actions.

Pull requests run checks only. Image publishing and deployment require `main`
and a non-pull-request event. Frontend-only changes do not trigger this workflow.

### Step 2: Test the backend

The `test` job starts a disposable MySQL 8 database and uses Node.js 22. It:

1. Installs native image/PDF build dependencies and runs `npm ci`.
2. Generates the Prisma client and applies migrations to the temporary database.
3. Runs `npm run lint`, `npm test`, and `npm run build`.
4. Checks Bash syntax and runs the deployment-script Python unit tests.
5. Produces a release tag in the format `COMMIT_SHA-RUN_ID-ATTEMPT`.

A failed check prevents the image-build and deployment stages from proceeding.
CI tests use the temporary database, not production RDS.

### Step 3: Build and publish the images

After tests pass on `main`, the `images` job authenticates to AWS, logs in to
ECR, and builds the Dockerfile's `runtime` and `migrations` targets. Both images
receive the same release tag, tying the API and migrations to the same source
revision and workflow attempt.

### Step 4: Send the deployment to EC2

The `deploy` job runs `deploy/send-deployment.py`. It packages `compose.yml`,
`Caddyfile`, and `deploy.sh`, normalizes Windows line endings, and sends them
using the SSM `AWS-RunShellScript` document.

On EC2, the configuration is extracted into:

```text
/opt/chameleon/releases/COMMIT_SHA-RUN_ID-ATTEMPT/
```

SSM then runs `deploy.sh` as root. GitHub waits for the SSM command's terminal
status, so sending the command alone does not count as deployment success.

### Step 5: Deploy on the server

`backend/scripts/deploy.sh` performs the following sequence:

1. Validates the release arguments, environment file, and RDS certificate bundle.
2. Acquires a deployment lock so server deployments cannot overlap.
3. Logs in to ECR with temporary Docker credential storage.
4. Writes the release's registry and tag to `image.env`.
5. Validates the Compose configuration and pulls both images.
6. Runs `prisma migrate deploy` through the dedicated migration container.
7. Starts the production services and waits up to 180 seconds for readiness.
8. On success, updates `/opt/chameleon/current` and, when applicable,
   `/opt/chameleon/previous` to track healthy releases.
9. Removes the temporary Docker login credentials when the script exits.

Migrations run while the old API is still serving traffic. Schema changes must
therefore remain compatible with that API. The production API has startup
migrations disabled because the separate migration step handles them.

This is a single-instance deployment, so container replacement can cause a short
interruption. It does not implement zero-downtime traffic switching.

## 5. Verify a release

Check that all three GitHub Actions jobs succeed. The deployment log includes
the SSM command ID and the server-side result.

Then check the public API, replacing the example domain:

```bash
curl --fail https://api.example.com/api/health
```

Expect HTTP 200 and `dbConnected: true`. Also test login and a file conversion
from the frontend. Configure the frontend's `NEXT_PUBLIC_API_URL` with the
HTTPS API origin and rebuild the frontend when that value changes.

The container health check does not validate public DNS, TLS, proxy rules,
CORS, or browser cookie behavior; the browser check covers those integration
points.

To inspect the containers from a root session on EC2:

```bash
cd /opt/chameleon/current
docker compose --project-name chameleon-backend --env-file /home/admin/chameleon/backend/.env --env-file image.env -f compose.yml ps
docker compose --project-name chameleon-backend --env-file /home/admin/chameleon/backend/.env --env-file image.env -f compose.yml logs --tail=100 backend
```

For a custom environment-file location, export `BACKEND_ENV_FILE` and use that
same path with `--env-file`.

## 6. Failure handling and rollback

| Failure | Result / first place to investigate |
| --- | --- |
| CI check or test fails | Deployment does not proceed; inspect the failed test-job step. |
| AWS role assumption fails | Compare the logged OIDC claims with the IAM trust policy and role variable. |
| Image build or push fails | Inspect the build logs, target architecture, and ECR permissions. |
| SSM command cannot run | Check instance ID, region, SSM Agent status, instance role, and network access. |
| Migration fails | The script stops before replacing the API; inspect the migration error and RDS connectivity. |
| New services fail startup/readiness | The script attempts to restore the preceding healthy release if one exists, and reports failure. |
| Internal health passes but browser access fails | Check DNS, HTTPS, proxy settings, frontend API URL, and CORS. |

Automatic rollback applies to the service startup/readiness failure path. It
does not reverse database migrations, and the first deployment has no previous
release to restore. A failed migration may also require database investigation.

For a later manual application rollback, select a retained release compatible
with the current database schema and run this on EC2 with real values:

```bash
sudo bash /opt/chameleon/releases/OLD_TAG/deploy.sh /opt/chameleon/releases/OLD_TAG YOUR_REGION ACCOUNT_ID.dkr.ecr.YOUR_REGION.amazonaws.com OLD_TAG
```

This runs that release's deployment process, including its pending migrations;
it does not downgrade the database. Supply the environment-file path as a fifth
argument if it differs from the default.

## 7. The routine for future changes

1. Make and test the backend change locally.
2. If the schema changes, generate and commit a backward-compatible Prisma migration.
3. Open a pull request and review the CI results.
4. Merge into `main` to trigger automatic deployment for the matching paths.
5. Check the Actions result, public health endpoint, and frontend behavior.

Keep production database backups and retain current/previous release images.
The deployment script preserves named volumes and old release directories; it
does not automatically clean up disk space.
