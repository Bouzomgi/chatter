import { describe, expect, it } from 'vitest'
import { App } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { ChatterStack } from '../../lib/chatter-stack.js'

// Skip esbuild bundling of the Lambda handlers — these tests only care about
// the hosting resources, and bundling every function makes them slow.
function synth(props: { domainName?: string; clientOrigin?: string; region?: string }) {
  const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } })
  const stack = new ChatterStack(app, 'TestStack', {
    jwtSecret: 'test-secret-do-not-use-in-real-life-0123456789',
    env: props.domainName ? { account: '123456789012', region: props.region ?? 'us-east-1' } : undefined,
    ...props,
  })
  return Template.fromStack(stack)
}

describe('ChatterStack custom domain', () => {
  it('creates no certificate or DNS records without a domain', () => {
    const template = synth({})

    template.resourceCountIs('AWS::CertificateManager::Certificate', 0)
    template.resourceCountIs('AWS::Route53::RecordSet', 0)
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: Match.objectLike({ AllowOrigins: ['http://localhost:5173'] }),
    })
  })

  it('attaches a certificate, aliases, and a matching CORS origin when a domain is set', () => {
    const template = synth({ domainName: 'chitchatter.link' })

    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'chitchatter.link',
      ValidationMethod: 'DNS',
    })
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({ Aliases: ['chitchatter.link'] }),
    })
    template.resourceCountIs('AWS::Route53::RecordSet', 2)
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: Match.objectLike({ AllowOrigins: ['https://chitchatter.link'] }),
    })
  })

  it('lets an explicit clientOrigin override the domain default', () => {
    const template = synth({ domainName: 'chitchatter.link', clientOrigin: 'https://www.chitchatter.link' })

    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: Match.objectLike({ AllowOrigins: ['https://www.chitchatter.link'] }),
    })
  })

  it('refuses a custom domain outside us-east-1', () => {
    expect(() => synth({ domainName: 'chitchatter.link', region: 'us-west-2' })).toThrow(/us-east-1/)
  })
})
