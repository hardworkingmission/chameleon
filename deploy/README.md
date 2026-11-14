# Backend on Debian EC2 with GitHub Actions and RDS

For persistent originals and conversion outputs, follow the [S3 storage setup](S3-STORAGE.md).

This deployment runs the backend only. RDS must be **MySQL**, matching
`backend/prisma/schema.prisma`. The frontend stays on its current hosting provider.

Pull requests run TypeScript checks, all backend tests against a disposable MySQL
service, and deployment-script checks. With the repository variable `ENABLE_AWS_DEPLOY=true`, a push to `main` runs those checks, builds
two images, pushes them to ECR, and runs the deployment on EC2 using Systems Manager.
GitHub authenticates with OIDC; the instance uses its IAM role to pull images.
No SSH key or long-lived AWS access key is needed in GitHub.

The deployment pulls both images, applies committed Prisma migrations, replaces
the API, and waits for its Docker health check. If the replacement is unhealthy,
it attempts to restore the previous containers and marks the workflow failed.
This is a single-instance deployment: expect a short interruption during replacement.
Database migrations are never automatically reversed.

Production uses `deploy/compose.yml`, which pulls the application and migration
images from ECR and connects to RDS through `DATABASE_URL`. The root
`docker-compose.yml` is for local development with a local MySQL container.
The production API disables startup migrations because the dedicated migration
image applies them before the API is replaced.

## 1. Existing EC2 and RDS

- Debian 12 or 13; `uname -m` reports `x86_64` or `aarch64`.
- EC2 and RDS need private network connectivity. Permit RDS port 3306 **from the
  EC2 security group**, and create a dedicated MySQL database/user for this app.
  The migration user needs DDL permissions on that database.
- Start with at least 2 GiB RAM; conversion workloads may require more. The API
  defaults to a 1 GiB container memory limit, configurable in the environment file.
- EC2 needs outbound HTTPS for ECR, SSM, image downloads, and certificate issuance
  (via internet/NAT or the relevant endpoints).
- For built-in HTTPS, point the API domain at an Elastic IP on this instance and
  allow inbound 80/443. Do not expose 4000 or 3306 publicly.
- With an existing ALB, terminate HTTPS there and permit EC2 port 4000 only from
  the ALB security group. Configure its health path as `/api/health`.

Create/attach an EC2 instance role with:

1. AWS managed policy `AmazonSSMManagedInstanceCore`.
2. The inline policy in `iam/ec2-ecr-policy.json`, replacing `ACCOUNT_ID` and `REGION`.

The instance role's trust principal is `ec2.amazonaws.com` with action
`sts:AssumeRole`. Attach it through an EC2 instance profile; retain any permissions
the instance already needs.

Copy `deploy/bootstrap-debian.sh` to the instance and run it once:

```bash
sudo bash bootstrap-debian.sh
```

It installs Docker/Compose if Docker is absent, the AWS CLI, SSM Agent, and the
RDS CA bundle. If Docker is already installed but Compose is missing, install
the Compose plugin for that Docker distribution before continuing. It does not
remove an existing Docker installation. Confirm the instance is **Online** in
Systems Manager before triggering deployment.

## 2. Configure application secrets on EC2

Deployment reads the existing backend `.env` on EC2 at
`/home/admin/chameleon/backend/.env`. If it is already populated, keep it and
restrict its permissions with `chmod 600`. For a new configuration only, copy
`deploy/backend.env.example` to the instance, then:

```bash
sudo install -d -m 700 /home/admin/chameleon/backend
sudo install -m 600 backend.env.example /home/admin/chameleon/backend/.env
sudoedit /home/admin/chameleon/backend/.env
```

Set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, and `APP_DOMAIN`.
Generate the JWT secret with `openssl rand -hex 32` on the instance.
Percent-encode special characters in the MySQL username/password, and keep the
connection URL single-quoted in the env file. The sample URL enables certificate
verification using the mounted RDS CA bundle. Never commit this populated file.
Do not `source` it in a shell: Docker Compose reads it as an environment file.

Choose one ingress configuration:

| Ingress | `COMPOSE_PROFILES` | `BACKEND_BIND_ADDRESS` | `TRUST_PROXY_HOPS` |
| --- | --- | --- | --- |
| Included Caddy, manages domain HTTPS | `https` | `127.0.0.1` | `1` |
| Existing Nginx/Caddy on this host | empty | `127.0.0.1` | `1` |
| Existing ALB, forwards directly to API | empty | `0.0.0.0` | `1` |

For an existing host proxy, forward to `http://127.0.0.1:4000`, replace incoming
`X-Forwarded-For` with the client address, and set `X-Forwarded-Proto`. Trusting
one hop is safe only when clients cannot bypass that proxy. Do not put another
CDN/proxy in front without revisiting this setting and forwarded-header handling.

`CORS_ORIGIN` is the exact HTTPS frontend origin, without a trailing slash.
The frontend's `NEXT_PUBLIC_API_URL` must be the HTTPS API origin and requires a
frontend rebuild when changed. Use frontend/API subdomains under the same site
(for example, `www.example.com` and `api.example.com`): the current authentication
cookie uses `SameSite=Lax`, so unrelated frontend/API domains need an auth change.

If RDS already has these tables but no Prisma migration history, baseline it
before the first deployment. Do not run a migration reset against production.
Enable RDS backups before applying schema changes. Use backward-compatible
migrations, since the old API serves traffic while migrations run.

## 3. Create the two ECR repositories

Run from an authenticated administrator terminal, substituting your region:

```bash
aws ecr create-repository --region YOUR_REGION --repository-name gold-ecr --image-tag-mutability IMMUTABLE --image-scanning-configuration scanOnPush=true
aws ecr create-repository --region YOUR_REGION --repository-name gold-ecr-migrations --image-tag-mutability IMMUTABLE --image-scanning-configuration scanOnPush=true
```

Skip creation if the repositories already exist. Each release is tagged with
`COMMIT_SHA-RUN_ID-ATTEMPT`, and both images use the same tag. Retain previous
release images for rollback. A retry that rebuilds a successfully pushed immutable
tag must start a **new full workflow run**, rather than repushing that tag.

## 4. Give GitHub Actions access through OIDC

In IAM, add the GitHub OIDC provider if it does not already exist:

- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

Create a deployment role using `iam/github-trust.json`, and attach
`iam/github-policy.json`. Replace `ACCOUNT_ID`, `REGION`, and
`EXACT_PRODUCTION_ENVIRONMENT_SUBJECT`. The policy grants ECR push for only the
two repositories and SSM Run Command for only the selected EC2 instance.
SSM executes as root on that instance, so access to this deployment role is
production administrative access.

Set the subject to the exact GitHub OIDC subject for your repository's
`production` environment. Depending on repository creation date / OIDC settings:

```text
repo:OWNER/REPO:environment:production
repo:OWNER@OWNER_ID/REPO@REPO_ID:environment:production
```

GitHub introduced immutable owner/repository IDs in subjects for new repositories
from July 15, 2026. Use the format applicable to your repository; do not use a
wildcard to bypass a subject mismatch. See the
[GitHub AWS OIDC guide](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)
and [AWS credentials action](https://github.com/aws-actions/configure-aws-credentials).

In GitHub, create an environment named **production**, restrict deployment
branches to **main**, and add these environment variables:

| Variable | Example / value |
| --- | --- |
| `AWS_REGION` | Optional override; defaults to `us-east-1`. Must match EC2/ECR. |
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::123456789012:role/chameleon-github-deploy` |
| `EC2_INSTANCE_ID` | Required target EC2 instance ID |
| `BACKEND_ENV_FILE` | Absolute path on EC2; defaults to `/home/admin/chameleon/backend/.env` |
| `EC2_DOCKER_PLATFORM` | `linux/amd64` for x86_64, `linux/arm64` for Graviton |

No application secrets go in these variables. The ARM build uses emulation and
may take longer because native dependencies can compile from source.
`BACKEND_ENV_FILE` contains only a path; the file contents remain on EC2. Both
the API and migration containers receive their environment from that file.
If using a custom path for manual Compose commands, export `BACKEND_ENV_FILE`
and use the same path with `--env-file`. Manual rollback scripts accept that
path as an optional fifth argument.
Replace `INSTANCE_ID` in the IAM policy with the same instance ID.

Set the **repository-level** Actions variable `ENABLE_AWS_DEPLOY` to `true` only
after configuring the production environment and IAM trust. Deployment is
disabled by default for new repositories and forks; CI still runs.

## 5. Deploy and verify

Commit/push the configuration to `main`, or run **Backend CI and EC2 deployment**
manually from the Actions tab on `main`. Other branches and PRs never deploy.
The SSM command ID appears in the workflow output. CI waits for the command's
terminal status and fails if migrations, startup, or rollback fail.

```bash
curl --fail https://api.example.com/api/health
```

Expected: HTTP 200 with `dbConnected: true`. Test frontend login and a conversion
after configuring the frontend API URL. The pipeline's internal health check
does not verify external DNS, TLS issuance, ALB rules, or browser cookies.

On the instance, inspect the current release:

```bash
cd /opt/chameleon/current
sudo docker compose --env-file /home/admin/chameleon/backend/.env --env-file image.env -f compose.yml ps
sudo docker compose --env-file /home/admin/chameleon/backend/.env --env-file image.env -f compose.yml logs --tail=100 backend
```

Run these commands from a root session if your user cannot enter the protected
directory. Avoid `docker compose config` without `--quiet` in shared logs: it can
display the resolved database credentials.

## Rollback and maintenance

An unhealthy new container triggers one automatic attempt to restore the previous
release. For a later application rollback, find the desired directory under
`/opt/chameleon/releases`, then run its script as root:

```bash
sudo bash /opt/chameleon/releases/OLD_TAG/deploy.sh /opt/chameleon/releases/OLD_TAG YOUR_REGION ACCOUNT_ID.dkr.ecr.YOUR_REGION.amazonaws.com OLD_TAG
```

This reapplies only pending migrations in that image and restores the old API
image; it does **not** undo schema changes. Choose a release compatible with the
current schema. `/opt/chameleon/previous` identifies the preceding healthy release.
Do not deploy a schema-breaking release and assume an image rollback will repair it.

Container restarts persist uploads/logs and Caddy certificates in named volumes.
The script does not delete old release directories/images or run `down -v`.
Review disk usage (`docker system df`, `df -h`) and retain at least the current and
previous releases when cleaning up. Refresh the RDS CA bundle as part of RDS
certificate rotation. Application file logs also need host/container log retention.

The earlier review's PDF resource bounds and rejected-upload cleanup findings
still apply. The container memory limit limits the impact on the host, but is
not a substitute for conversion workload controls.

## References

- [Docker Engine on Debian](https://docs.docker.com/engine/install/debian/)
- [SSM Agent on Debian](https://docs.aws.amazon.com/systems-manager/latest/userguide/agent-install-deb.html)
- [SSM instance permissions](https://docs.aws.amazon.com/systems-manager/latest/userguide/setup-instance-permissions.html)
- [RDS TLS certificates](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html)
