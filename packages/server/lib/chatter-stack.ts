import path from 'path'
import { fileURLToPath } from 'url'
import { Stack, StackProps, RemovalPolicy, Duration } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { HttpApi, HttpMethod, CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface ChatterStackProps extends StackProps {
  /**
   * Signs and verifies auth JWTs. Defaults to an obviously-fake value so
   * `cdk synth` works in CI with no secrets configured — a real deploy must
   * override this (see the deploy pipeline step in CLAUDE.md's roadmap).
   */
  jwtSecret: string
}

// Table shapes mirror the data model in the Lambda design doc. Fields land
// as each feature is built — this stack starts with just the keys.
export class ChatterStack extends Stack {
  constructor(scope: Construct, id: string, props: ChatterStackProps) {
    super(scope, id, props)

    // --- Data layer ---
    // DESTROY is fine while there's no real data in these tables; revisit
    // (RETAIN, point-in-time recovery) before anything real is stored.
    const tableDefaults = {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    }

    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      ...tableDefaults,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    })

    // DynamoDB has no unique-constraint concept outside of primary keys, so
    // email/username uniqueness is enforced by conditionally writing to
    // these reverse-lookup tables inside the same transaction as the user
    // record (see src/lib/users.ts). They also make login-by-email a single
    // lookup instead of a table scan.
    const usersByEmailTable = new dynamodb.Table(this, 'UsersByEmailTable', {
      ...tableDefaults,
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
    })

    const usersByUsernameTable = new dynamodb.Table(this, 'UsersByUsernameTable', {
      ...tableDefaults,
      partitionKey: { name: 'username', type: dynamodb.AttributeType.STRING },
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
    const httpApi = new HttpApi(this, 'HttpApi', {
      corsPreflight: {
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST],
        allowHeaders: ['content-type'],
        // Cookie auth requires credentialed CORS, which the spec forbids
        // combining with a wildcard origin — so this has to be a real origin
        // even before there's a real deployment. Swap in the CloudFront
        // domain once the client is deployed (roadmap step 7).
        allowCredentials: true,
        allowOrigins: ['http://localhost:5173'],
      },
    })

    const healthFn = new NodejsFunction(this, 'HealthFn', {
      entry: path.join(__dirname, '../src/http/health.ts'),
      runtime: Runtime.NODEJS_20_X,
    })
    httpApi.addRoutes({
      path: '/health',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('HealthIntegration', healthFn),
    })

    const authEnv = {
      JWT_SECRET: props.jwtSecret,
      USERS_TABLE: usersTable.tableName,
      USERS_BY_EMAIL_TABLE: usersByEmailTable.tableName,
      USERS_BY_USERNAME_TABLE: usersByUsernameTable.tableName,
    }

    const authFn = (name: string, entry: string) =>
      new NodejsFunction(this, name, {
        entry: path.join(__dirname, entry),
        runtime: Runtime.NODEJS_20_X,
        timeout: Duration.seconds(10),
        environment: authEnv,
      })

    const registerFn = authFn('RegisterFn', '../src/http/auth/register.ts')
    const loginFn = authFn('LoginFn', '../src/http/auth/login.ts')
    const logoutFn = authFn('LogoutFn', '../src/http/auth/logout.ts')
    const meFn = authFn('MeFn', '../src/http/auth/me.ts')

    usersTable.grantReadWriteData(registerFn)
    usersByEmailTable.grantReadWriteData(registerFn)
    usersByUsernameTable.grantReadWriteData(registerFn)

    usersTable.grantReadData(loginFn)
    usersByEmailTable.grantReadData(loginFn)

    usersTable.grantReadData(meFn)

    httpApi.addRoutes({
      path: '/auth/register',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('RegisterIntegration', registerFn),
    })
    httpApi.addRoutes({
      path: '/auth/login',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('LoginIntegration', loginFn),
    })
    httpApi.addRoutes({
      path: '/auth/logout',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('LogoutIntegration', logoutFn),
    })
    httpApi.addRoutes({
      path: '/auth/me',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('MeIntegration', meFn),
    })
  }
}
