#!/usr/bin/env node
import { App } from 'aws-cdk-lib'
import { ChatterStack } from '../lib/chatter-stack.js'

const app = new App()

new ChatterStack(app, 'ChatterStack')
