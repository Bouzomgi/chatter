import path from 'path'
import { fileURLToPath } from 'url'
import { Stack, StackProps, RemovalPolicy, Duration } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { HttpApi, HttpMethod, CorsHttpMethod, WebSocketApi, WebSocketStage } from 'aws-cdk-lib/aws-apigatewayv2'
import {
  HttpLambdaIntegration,
  WebSocketLambdaIntegration,
} from 'aws-cdk-lib/aws-apigatewayv2-integrations'

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

    const participantsTable = new dynamodb.Table(this, 'ParticipantsTable', {
      ...tableDefaults,
      partitionKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    })

    // The table's own key answers "who's in this conversation." $connect and
    // $disconnect need the reverse — "what conversations is this user in" —
    // to rejoin/leave rooms, which is exactly what a GSI is for.
    participantsTable.addGlobalSecondaryIndex({
      indexName: 'ByUserIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    })

    const messagesTable = new dynamodb.Table(this, 'MessagesTable', {
      ...tableDefaults,
      partitionKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sortKey', type: dynamodb.AttributeType.STRING }, // createdAt#messageId
    })

    const conversationsTable = new dynamodb.Table(this, 'ConversationsTable', {
      ...tableDefaults,
      partitionKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
    })

    // Same uniqueness trick as UsersByEmail/UsersByUsername, applied to "does
    // a conversation with exactly this participant set already exist" — see
    // findOrCreateConversation() in src/lib/conversations.ts.
    const conversationsByKeyTable = new dynamodb.Table(this, 'ConversationsByKeyTable', {
      ...tableDefaults,
      partitionKey: { name: 'participantSetKey', type: dynamodb.AttributeType.STRING },
    })

    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      ...tableDefaults,
      partitionKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
    })

    // No Socket.io equivalent — exists because $disconnect only gets a bare
    // connectionId and needs a way back to the user (and from there, the
    // conversations) it belonged to.
    const connectionUsersTable = new dynamodb.Table(this, 'ConnectionUsersTable', {
      ...tableDefaults,
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
    })

    // --- API layer ---
    const httpApi = new HttpApi(this, 'HttpApi', {
      corsPreflight: {
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.PUT, CorsHttpMethod.PATCH],
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
    const wsTicketFn = authFn('WsTicketFn', '../src/http/auth/wsTicket.ts')

    usersTable.grantReadWriteData(registerFn)
    usersByEmailTable.grantReadWriteData(registerFn)
    usersByUsernameTable.grantReadWriteData(registerFn)

    usersTable.grantReadData(loginFn)
    usersByEmailTable.grantReadData(loginFn)

    usersTable.grantReadData(meFn)
    // wsTicketFn only signs a token — no table access needed.

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
    httpApi.addRoutes({
      path: '/auth/ws-ticket',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('WsTicketIntegration', wsTicketFn),
    })

    // --- WebSocket layer ---
    const wsEnv = {
      JWT_SECRET: props.jwtSecret,
      PARTICIPANTS_TABLE: participantsTable.tableName,
      MESSAGES_TABLE: messagesTable.tableName,
      CONNECTIONS_TABLE: connectionsTable.tableName,
      CONNECTION_USERS_TABLE: connectionUsersTable.tableName,
    }

    const wsFn = (name: string, entry: string) =>
      new NodejsFunction(this, name, {
        entry: path.join(__dirname, entry),
        runtime: Runtime.NODEJS_20_X,
        timeout: Duration.seconds(10),
        environment: wsEnv,
      })

    const onConnectFn = wsFn('OnConnectFn', '../src/ws/onConnect.ts')
    const onDisconnectFn = wsFn('OnDisconnectFn', '../src/ws/onDisconnect.ts')

    participantsTable.grantReadData(onConnectFn)
    connectionsTable.grantWriteData(onConnectFn)
    connectionUsersTable.grantWriteData(onConnectFn)

    participantsTable.grantReadData(onDisconnectFn)
    connectionsTable.grantWriteData(onDisconnectFn)
    connectionUsersTable.grantReadWriteData(onDisconnectFn)

    const sendMessageFn = wsFn('SendMessageFn', '../src/ws/sendMessage.ts')
    participantsTable.grantReadWriteData(sendMessageFn) // read to check membership, write for markUnreadForOthers
    messagesTable.grantWriteData(sendMessageFn)
    connectionsTable.grantReadWriteData(sendMessageFn) // read to fan out, write to drop stale connections
    connectionUsersTable.grantReadWriteData(sendMessageFn) // read to identify the sender, write to drop stale ones

    const webSocketApi = new WebSocketApi(this, 'WebSocketApi', {
      connectRouteOptions: { integration: new WebSocketLambdaIntegration('OnConnectIntegration', onConnectFn) },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration('OnDisconnectIntegration', onDisconnectFn),
      },
    })
    webSocketApi.addRoute('sendMessage', {
      integration: new WebSocketLambdaIntegration('SendMessageIntegration', sendMessageFn),
    })

    const webSocketStage = new WebSocketStage(this, 'WebSocketStage', {
      webSocketApi,
      stageName: 'prod',
      autoDeploy: true,
    })

    // postToConnection (the fan-out mechanism) is a call against this stage's
    // management API, not a DynamoDB permission — needs its own grant.
    webSocketStage.grantManagementApiAccess(sendMessageFn)

    // --- REST: users/conversations ---
    const restEnv = {
      JWT_SECRET: props.jwtSecret,
      USERS_TABLE: usersTable.tableName,
      PARTICIPANTS_TABLE: participantsTable.tableName,
      MESSAGES_TABLE: messagesTable.tableName,
      CONVERSATIONS_TABLE: conversationsTable.tableName,
      CONVERSATIONS_BY_KEY_TABLE: conversationsByKeyTable.tableName,
    }

    const restFn = (name: string, entry: string) =>
      new NodejsFunction(this, name, {
        entry: path.join(__dirname, entry),
        runtime: Runtime.NODEJS_20_X,
        timeout: Duration.seconds(10),
        environment: restEnv,
      })

    const getUsersFn = restFn('GetUsersFn', '../src/http/users/getUsers.ts')
    const updateMeFn = restFn('UpdateMeFn', '../src/http/users/updateMe.ts')
    const createConversationFn = restFn('CreateConversationFn', '../src/http/conversations/createConversation.ts')
    const getConversationsFn = restFn('GetConversationsFn', '../src/http/conversations/getConversations.ts')
    const getMessagesFn = restFn('GetMessagesFn', '../src/http/conversations/getMessages.ts')
    const markReadFn = restFn('MarkReadFn', '../src/http/conversations/markRead.ts')

    usersTable.grantReadData(getUsersFn)
    usersTable.grantReadWriteData(updateMeFn)

    usersTable.grantReadData(createConversationFn)
    participantsTable.grantReadWriteData(createConversationFn)
    conversationsTable.grantReadWriteData(createConversationFn)
    conversationsByKeyTable.grantReadWriteData(createConversationFn)

    usersTable.grantReadData(getConversationsFn)
    participantsTable.grantReadData(getConversationsFn)
    messagesTable.grantReadData(getConversationsFn)
    conversationsTable.grantReadData(getConversationsFn)

    participantsTable.grantReadData(getMessagesFn)
    messagesTable.grantReadData(getMessagesFn)
    conversationsTable.grantReadData(getMessagesFn)

    participantsTable.grantReadWriteData(markReadFn)

    httpApi.addRoutes({
      path: '/users',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetUsersIntegration', getUsersFn),
    })
    httpApi.addRoutes({
      path: '/users/me',
      methods: [HttpMethod.PUT],
      integration: new HttpLambdaIntegration('UpdateMeIntegration', updateMeFn),
    })
    httpApi.addRoutes({
      path: '/conversations',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('CreateConversationIntegration', createConversationFn),
    })
    httpApi.addRoutes({
      path: '/conversations',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetConversationsIntegration', getConversationsFn),
    })
    httpApi.addRoutes({
      path: '/conversations/{id}/messages',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetMessagesIntegration', getMessagesFn),
    })
    httpApi.addRoutes({
      path: '/conversations/{id}/read',
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration('MarkReadIntegration', markReadFn),
    })
  }
}
