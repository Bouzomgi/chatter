# Deploying Chatter

One-time AWS setup for `.github/workflows/deploy.yml`, which runs on every push to `main`. None of this is automated — it's account-level setup that has to happen before the pipeline can run at all.

## 1. Bootstrap CDK (once per AWS account/region)

From your own machine, with AWS credentials configured locally:

```sh
cd packages/server
pnpm exec cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
```

This provisions the S3 bucket/IAM roles CDK itself needs to deploy anything — a one-time step, unrelated to this app specifically.

## 2. Let GitHub Actions assume a role via OIDC

No long-lived AWS access keys stored as GitHub secrets — the workflow assumes a role via OIDC instead.

1. In IAM → Identity providers, add `token.actions.githubusercontent.com` as an OIDC provider (skip if your account already has one — it's account-wide, not per-repo).
2. Create a role (e.g. `chatter-deploy`) trusting that provider, scoped to this repo and branch:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": { "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com" },
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
         "StringLike": { "token.actions.githubusercontent.com:sub": "repo:Bouzomgi/chatter:ref:refs/heads/main" }
       }
     }]
   }
   ```
3. Attach permissions the deploy needs — CloudFormation, Lambda, DynamoDB, API Gateway (v2), S3, CloudFront, IAM (CDK creates Lambda execution roles), and CloudWatch Logs. `AdministratorAccess` is the pragmatic starting point for a personal project; worth scoping down later, not blocking on it now.

## 3. Configure the repo

**Secrets** (Settings → Secrets and variables → Actions → Secrets):
- `AWS_DEPLOY_ROLE_ARN` — the role's ARN from step 2
- `JWT_SECRET` — a real secret, e.g. `openssl rand -base64 32`. **Must** be at least 32 characters (the server throws at cold-start otherwise, same as the original project).

**Variables** (same page, Variables tab):
- `AWS_REGION` — e.g. `us-east-1`
- `CLIENT_ORIGIN` — leave unset for now (see the bootstrap note below)

## 4. First deploy — a two-step bootstrap

`ChatterStack`'s CORS config needs the client's real origin (credentialed CORS can't use a wildcard), but that origin is the CloudFront domain the stack itself creates — it doesn't exist before the first deploy.

1. Push to `main` with `CLIENT_ORIGIN` unset. The stack deploys with CORS pointed at `http://localhost:5173` (harmless — nothing depends on that being right yet) and creates the CloudFront distribution.
2. Find `ClientDistributionDomain` in the workflow's "Read stack outputs" step (or `aws cloudformation describe-stacks --stack-name ChatterStack`).
3. Set the `CLIENT_ORIGIN` repo variable to `https://<that domain>`.
4. Push again (or re-run the workflow). This redeploy updates CORS to the real origin — everything after this is a normal single-step deploy.

## What the pipeline actually does

See `.github/workflows/deploy.yml`: `cdk deploy` first (backend + the S3 bucket/CloudFront distribution, empty), then builds the client with that deploy's own API URLs baked in via `VITE_API_URL`/`VITE_WS_URL`, syncs the build to S3, and invalidates the CloudFront cache. Backend and frontend can't deploy in parallel here — the client build depends on knowing the backend's URLs first.
