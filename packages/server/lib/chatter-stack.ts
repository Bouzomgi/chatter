import path from 'path'
import { fileURLToPath } from 'url'
import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Table shapes mirror packages/server/README.md's data model doc. Fields land
// as each feature is built — this stack starts with just the keys.
export class ChatterStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // --- Data layer ---
    // DESTROY is fine while there's no real data in these tables; revisit
    // (RETAIN, point-in-time recovery) before anything real is stored.
    const tableDefaults = {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    }

    new dynamodb.Table(this, 'UsersTable', {
      ...tableDefaults,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    })

    new dynamodb.Table(this, 'ParticipantsTable', {
      ...tableDefaults,
      partitionKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    })

    new dynamodb.Table(this, 'MessagesTable', {
      ...tableDefaults,
      partitionKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sortKey', type: dynamodb.AttributeType.STRING }, // createdAt#messageId
    })

    new dynamodb.Table(this, 'ConnectionsTable', {
      ...tableDefaults,
      partitionKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
    })

    // --- API layer ---
    // First functional slice: a health check behind an HTTP API, so CI has
    // something real to synth/deploy/hit while later routes get built out.
    const healthFn = new NodejsFunction(this, 'HealthFn', {
      entry: path.join(__dirname, '../src/http/health.ts'),
      runtime: Runtime.NODEJS_20_X,
    })

    const httpApi = new HttpApi(this, 'HttpApi')
    httpApi.addRoutes({
      path: '/health',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('HealthIntegration', healthFn),
    })
  }
}
