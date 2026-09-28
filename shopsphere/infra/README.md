# Infrastructure (reference only - not applied)

This Terraform config describes the AWS topology that `docker-compose.yml`
mirrors locally. Per the current scope decision, **nobody runs
`terraform apply` from this repo** - it exists to show what deploying
ShopSphere would look like, and to make the local/prod parity explicit:

| Local (docker-compose.yml) | AWS (this directory)                          |
| --------------------------- | ---------------------------------------------- |
| `postgres` (pgvector image)  | RDS Postgres 15.7 + pgvector (`rds.tf`)         |
| `api` container              | ECS Fargate service behind an ALB (`ecs.tf`)    |
| `web` container (nginx)      | S3 + CloudFront static hosting (`web-hosting.tf`) |
| `otel-collector`/`prometheus`| CloudWatch dashboards + alarms (`dashboards.tf`) |
| env vars in compose file     | Secrets Manager entries (`secrets.tf`)          |

## If you did want to apply this

1. `terraform init -backend-config="bucket=<your-state-bucket>" -backend-config="key=shopsphere/<env>.tfstate" -backend-config="region=<region>"`
2. `terraform plan -var="environment=staging"` and review every resource.
3. `terraform apply`.
4. Build and push the API image: `docker build -t <ecr_repository_url>:latest apps/api && docker push <ecr_repository_url>:latest`, then force a new ECS deployment.
5. Build the web app against the ALB's/CloudFront's real URLs and sync to S3: `aws s3 sync apps/web/dist s3://<web_bucket_name> --delete`.
6. Run `apps/api/prisma/pgvector-extension.sql` once against the new RDS instance (`psql "$DATABASE_URL" -f apps/api/prisma/pgvector-extension.sql`) to add the pgvector column/index that Prisma's schema can't express.
7. Put a real value into the `anthropic-api-key` secret (`aws secretsmanager put-secret-value ...`) - it's created empty on purpose.

## Deliberately out of scope here

- Multi-AZ NAT (single NAT gateway to keep the reference cheap)
- A second environment/workspace split (would duplicate every resource with `count`/`for_each` per env)
- TLS/ACM certificate + Route53 (left as `viewer_certificate { cloudfront_default_certificate = true }` and a plain ALB listener on :80)
- CI/CD wiring that actually runs `terraform apply` - see `.github/workflows/ci.yml`, which only runs `terraform fmt -check` and `terraform validate`
