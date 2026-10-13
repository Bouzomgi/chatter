#!/usr/bin/env node
import { App } from 'aws-cdk-lib'
import { ChatterStack } from '../lib/chatter-stack.js'

const app = new App()

const domainName = process.env.DOMAIN_NAME || undefined

new ChatterStack(app, 'ChatterStack', {
  // Only pinned when a custom domain is in play — the hosted-zone lookup
  // needs a concrete account/region. Left env-agnostic otherwise so CI synth
  // works with no AWS credentials.
  env: domainName
    ? { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
    : undefined,
  domainName,
  // Falls back to a clearly-fake value so `cdk synth`/`cdk diff` work in CI
  // with no secrets configured. A real `cdk deploy` must pass the real
  // secret, e.g. via `JWT_SECRET=... cdk deploy`.
  jwtSecret: process.env.JWT_SECRET ?? 'unsafe-dev-secret-do-not-deploy-with-this-value',
  // Unset on a from-scratch deploy without DOMAIN_NAME — see DEPLOY.md for
  // the two-step bootstrap this requires. With DOMAIN_NAME set it defaults to
  // https://<DOMAIN_NAME>, so this can stay unset.
  // `|| undefined`: an unset GitHub Actions variable arrives as '', not unset.
  clientOrigin: process.env.CLIENT_ORIGIN || undefined,
})
