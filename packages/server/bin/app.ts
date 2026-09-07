#!/usr/bin/env node
import { App } from 'aws-cdk-lib'
import { ChatterStack } from '../lib/chatter-stack.js'

const app = new App()

new ChatterStack(app, 'ChatterStack', {
  // Falls back to a clearly-fake value so `cdk synth`/`cdk diff` work in CI
  // with no secrets configured. A real `cdk deploy` must pass the real
  // secret, e.g. via `JWT_SECRET=... cdk deploy`.
  jwtSecret: process.env.JWT_SECRET ?? 'unsafe-dev-secret-do-not-deploy-with-this-value',
})
