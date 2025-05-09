---
title: "A2A/docs at main · google/A2A"
description: "The Agent2Agent Protocol (A2A) is an open protocol designed to enable interoperability and communication between opaque agentic systems without sharing their internal states or tools. It allows agents to collaboratively accomplish tasks on behalf of end users by exchanging context, status, instructions, and data in their native formats. The protocol is based on HTTP transport and JSON-RPC 2.0 messaging, supports asynchronous operations including streaming and push notifications, and incorporates enterprise-grade authentication and authorization mechanisms. A2A defines core objects such as Tasks, Messages, and Artifacts to manage task execution and results. Remote agents publish Agent Cards describing their capabilities and authentication requirements, enabling clients to discover and interact with them effectively. The protocol supports multi-turn conversations, structured data exchange, and provides error handling according to JSON-RPC standards, making it suitable for complex, secure, and scalable agent-to-agent interactions."
clipdate: 2025-05-07
source: "https://github.com/google/A2A/blob/main/docs/documentation.md"
tags:
  - "agentToAgent"
  - "interoperability"
  - "opaqueAgents"
  - "jsonRpc"
  - "httpTransport"
  - "asyncCommunication"
  - "streamingSupport"
  - "pushNotifications"
  - "authentication"
  - "agentCard"
  - "taskManagement"
  - "artifacts"
  - "messaging"
  - "multiTurnConversations"
  - "structuredOutput"
  - "errorHandling"
---
> [!summary]- Summary
> - A2A (Agent2Agent) is an open protocol for interoperability between opaque agentic systems.
> - It enables agents to accomplish tasks without sharing internal data, only exchanging context, status, instructions, and data.
> - Key principles: simple, enterprise-ready, async-first, modality-agnostic, and opaque execution.
> - Three actors: User (end user), Client (entity requesting actions), and Remote Agent (opaque agent/server).
> - Uses HTTP transport and JSON-RPC 2.0 for communication.
> - Supports asynchronous long-running tasks with polling, streaming (SSE), and push notifications.
> - Authentication follows OpenAPI specs; credentials exchanged out of band in HTTP headers.
> - Remote Agents publish an Agent Card describing capabilities and authentication.
> - Tasks represent stateful entities for accomplishing goals, with statuses and history.
> - Artifacts are immutable results produced by agents; Messages are for communication.
> - Supports multi-turn conversations, streaming updates, and structured output.
> - Error handling uses standard JSON-RPC error codes.
> - Sample JSON requests and responses are provided for key operations like sending tasks, getting tasks, canceling, and push notification setup.

[Open in github.dev](https://github.dev/) [Open in a new github.dev tab](https://github.dev/) [Open in codespace](https://github.com/codespaces/new/google/A2A/tree/main?resume=1)

An open protocol enabling Agent-to-Agent interoperability, bridging the gap between opaque agentic systems.

[![](https://github.com/google/A2A/raw/main/docs/assets/a2a-actors.png)](https://github.com/google/A2A/blob/main/docs/assets/a2a-actors.png)

## Key Principles

Using A2A, agents accomplish tasks for end users without sharing memory, thoughts, or tools. Instead the agents exchange context, status, instructions, and data in their native modalities.

- **Simple**: Reuse existing standards
- **Enterprise Ready**: Auth, Security, Privacy, Tracing, Monitoring
- **Async First**: (Very) Long running-tasks and human-in-the-loop
- **Modality Agnostic**: text, audio/video, forms, iframe, etc.
- **Opaque Execution**: Agents do not have to share thoughts, plans, or tools.

## Overview

### Actors

The A2A protocol has three actors:

- **User** The end user (human or service) that is using an agentic system to accomplish tasks.
- **Client** The entity (service, agent, application) that is requesting an action from an opaque agent on behalf of the user.
- **Remote Agent (Server)** The opaque ("black box") agent which is the A2A server.

### Transport

The protocol leverages HTTP for transport between the client and the remote agent. Depending on the capabilities of the client and the remote agent, they may leverage SSE for supporting streaming for receiving updates from the server.

A2A leverages [JSON-RPC 2.0](https://www.jsonrpc.org/specification) as the data exchange format for communication between a Client and a Remote Agent.

### Async

A2A clients and servers can use standard request/response patterns and poll for updates. However, A2A also supports streaming updates through SSE (while connected) and receiving while disconnected.

A2A models agents as enterprise applications (and can do so because A2A agents are opaque and do not share tools and resources). This quickly brings enterprise-readiness to agentic interop.

A2A follows [OpenAPI's Authentication specification](https://swagger.io/docs/specification/v3_0/authentication/) for authentication. Importantly, A2A agents do not exchange identity information within the A2A protocol. Instead, they obtain materials (such as tokens) out of band and transmit materials in HTTP headers and not in A2A payloads.

While A2A does not transmit identity in-band, servers do send authentication requirements in A2A payloads. At minimum, servers are expected to publish their requirements in their [Agent Card](https://github.com/google/A2A/blob/main/docs/#agent-card). Thoughts about discovering agent cards are in .

Clients should use one of the servers published authentication protocols to authenticate their identity and obtain credential material. A2A servers should authenticate **every** request and reject or challenge requests with standard HTTP response codes (401, 403), and authentication-protocol-specific headers and bodies (such as a HTTP 401 response with a [WWW-Authenticate](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/WWW-Authenticate) header indicating the required authentication schema, or OIDC discovery document at a well-known path). More details discussed in .

> Note: If an agent requires that the client/user provide additional credentials during execution of a task (for example, to use a specific tool), the agent should return a task status of `Input-Required` with the payload being an Authentication structure. The client should, again, obtain credential material out of band to A2A.

## Agent Card

Remote Agents that support A2A are required to publish an **Agent Card** in JSON format describing the agent's capabilities/skills and authentication mechanism. Clients use the Agent Card information to identify the best agent that can perform a task and leverage A2A to communicate with that remote agent.

### Discovery

We recommend agents host their Agent Card at `https://DOMAIN/.well-known/agent.json`. This is compatible with a DNS approach where the client finds the server IP via DNS and sends an HTTP `GET` to retrieve the agent card. We also anticipate that systems will maintain private registries (e.g. an 'Agent Catalog' or private marketplace, etc). More discussion can be found in .

### Representation

Following is the proposed representation of an Agent Card

```
// An AgentCard conveys key information:
// - Overall details (version, name, description, uses)
// - Skills: A set of capabilities the agent can perform
// - Default modalities/content types supported by the agent.
// - Authentication requirements
interface AgentCard {
  // Human readable name of the agent.
  // (e.g. "Recipe Agent")
  name: string;
  // A human-readable description of the agent. Used to assist users and
  // other agents in understanding what the agent can do.
  // (e.g. "Agent that helps users with recipes and cooking.")
  description: string;
  // A URL to the address the agent is hosted at.
  url: string;
  // The service provider of the agent
  provider?: {
    organization: string;
    url: string;
  };
  // The version of the agent - format is up to the provider. (e.g. "1.0.0")
  version: string;
  // A URL to documentation for the agent.
  documentationUrl?: string;
  // Optional capabilities supported by the agent.
  capabilities: {
    streaming?: boolean; // true if the agent supports SSE
    pushNotifications?: boolean; // true if the agent can notify updates to client
    stateTransitionHistory?: boolean; //true if the agent exposes status change history for tasks
  };
  // Authentication requirements for the agent.
  // Intended to match OpenAPI authentication structure.
  authentication: {
    schemes: string[]; // e.g. Basic, Bearer
    credentials?: string; //credentials a client should use for private cards
  };
  // The set of interaction modes that the agent
  // supports across all skills. This can be overridden per-skill.
  defaultInputModes: string[]; // supported mime types for input
  defaultOutputModes: string[]; // supported mime types for output
  // Skills are a unit of capability that an agent can perform.
  skills: {
    id: string; // unique identifier for the agent's skill
    name: string; //human readable name of the skill
    // description of the skill - will be used by the client or a human
    // as a hint to understand what the skill does.
    description: string;
    // Set of tag words describing classes of capabilities for this specific
    // skill (e.g. "cooking", "customer support", "billing")
    tags: string[];
    // The set of example scenarios that the skill can perform.
    // Will be used by the client as a hint to understand how the skill can be
    // used. (e.g. "I need a recipe for bread")
    examples?: string[]; // example prompts for tasks
    // The set of interaction modes that the skill supports
    // (if different than the default)
    inputModes?: string[]; // supported mime types for input
    outputModes?: string[]; // supported mime types for output
  }[];
}
```

## Agent-to-Agent Communication

The communication between a Client and a Remote Agent is oriented towards ***task completion*** where agents collaboratively fulfill an end user's request. A Task object allows a Client and a Remote Agent to collaborate for completing the submitted task.

A task can be completed by a remote agent immediately or it can be long-running. For long-running tasks, the client may poll the agent for fetching the latest status. Agents can also push notifications to the client via SSE (if connected) or through an external notification service.

## Core Objects

### Task

A Task is a stateful entity that allows Clients and Remote Agents to achieve a specific outcome and generate results. Clients and Remote Agents exchange Messages within a Task. Remote Agents generate results as Artifacts.

A Task is always created by a Client and the status is always determined by the Remote Agent. Multiple Tasks may be part of a common session (denoted by optional sessionId) if required by the client. To do so, the Client sets an optional sessionId when creating the Task.

The agent may:

- fulfill the request immediately
- schedule work for later
- reject the request
- negotiate a different modality
- ask the client for more information
- delegate to other agents and systems

Even after fulfilling the goal, the client can request more information or a change in the context of that same Task. (For example client: "draw a picture of a rabbit", agent: "<picture>", client: "make it red").

Tasks are used to transmit [Artifacts](https://github.com/google/A2A/blob/main/docs/#artifact) (results) and [Messages](https://github.com/google/A2A/blob/main/docs/#message) (thoughts, instructions, anything else). Tasks maintain a status and an optional history of status and Messages.

```
interface Task {
  id: string; // unique identifier for the task
  sessionId: string; // client-generated id for the session holding the task.
  status: TaskStatus; // current status of the task
  history?: Message[];
  artifacts?: Artifact[]; // collection of artifacts created by the agent.
  metadata?: Record<string, any>; // extension metadata
}
// TaskState and accompanying message.
interface TaskStatus {
  state: TaskState;
  message?: Message; //additional status updates for client
  timestamp?: string; // ISO datetime value
}
// sent by server during sendSubscribe or subscribe requests
interface TaskStatusUpdateEvent {
  id: string; //Task id
  status: TaskStatus;
  final: boolean; //indicates the end of the event stream
  metadata?: Record<string, any>;
}
// sent by server during sendSubscribe or subscribe requests
interface TaskArtifactUpdateEvent {
  id: string; //Task id
  artifact: Artifact;
  metadata?: Record<string, any>;
}
// Sent by the client to the agent to create, continue, or restart a task.
interface TaskSendParams {
  id: string;
  sessionId?: string; //server creates a new sessionId for new tasks if not set
  message: Message;
  historyLength?: number; //number of recent messages to be retrieved
  // where the server should send notifications when disconnected.
  pushNotification?: PushNotificationConfig;
  metadata?: Record<string, any>; // extension metadata
}
type TaskState =
  | "submitted"
  | "working"
  | "input-required"
  | "completed"
  | "canceled"
  | "failed"
  | "unknown";
```

### Artifact

Agents generate Artifacts as an end result of a Task. Artifacts are immutable, can be named, and can have multiple parts. A streaming response can append parts to existing Artifacts.

A single Task can generate many Artifacts. For example, "create a webpage" could create separate HTML and image Artifacts.

```
interface Artifact {
  name?: string;
  description?: string;
  parts: Part[];
  metadata?: Record<string, any>;
  index: number;
  append?: boolean;
  lastChunk?: boolean;
}
```

### Message

A Message contains any content that is not an Artifact. This can include things like agent thoughts, user context, instructions, errors, status, or metadata.

All content from a client comes in the form of a Message. Agents send Messages to communicate status or to provide instructions (whereas generated results are sent as Artifacts).

A Message can have multiple parts to denote different pieces of content. For example, a user request could include a textual description from a user and then multiple files used as context from the client.

```
interface Message {
  role: "user" | "agent";
  parts: Part[];
  metadata?: Record<string, any>;
}
```

### Part

A fully formed piece of content exchanged between a client and a remote agent as part of a Message or an Artifact. Each Part has its own content type and metadata.

```
interface TextPart {
  type: "text";
  text: string;
}
interface FilePart {
  type: "file";
  file: {
    name?: string;
    mimeType?: string;
    // oneof {
    bytes?: string; //base64 encoded content
    uri?: string;
    //}
  };
}
interface DataPart {
  type: "data";
  data: Record<string, any>;
}
type Part = (TextPart | FilePart | DataPart) & {
  metadata: Record<string, any>;
};
```

### Push Notifications

A2A supports a secure notification mechanism whereby an agent can notify a client of an update outside of a connected session via a PushNotificationService. Within and across enterprises, it is critical that the agent verifies the identity of the notification service, authenticates itself with the service, and presents an identifier that ties the notification to the executing Task.

The target server of the PushNotificationService should be considered a separate service, and is not guaranteed (or even expected) to be the client directly. This PushNotificationService is responsible for authenticating and authorizing the agent and for proxying the verified notification to the appropriate endpoint (which could be anything from a pub/sub queue, to an email inbox or other service, etc).

For contrived scenarios with isolated client-agent pairs (e.g. local service mesh in a contained VPC, etc.) or isolated environments without enterprise security concerns, the client may choose to simply open a port and act as its own PushNotificationService. Any enterprise implementation will likely have a centralized service that authenticates the remote agents with trusted notification credentials and can handle online/offline scenarios. (This should be thought of similarly to a mobile Push Notification Service).

```
interface PushNotificationConfig {
  url: string;
  token?: string; // token unique to this task/session
  authentication?: {
    schemes: string[];
    credentials?: string;
  };
}
interface TaskPushNotificationConfig {
  id: string; //task id
  pushNotificationConfig: PushNotificationConfig;
}
```
```
{
  "name": "Google Maps Agent",
  "description": "Plan routes, remember places, and generate directions",
  "url": "https://maps-agent.google.com",
  "provider": {
    "organization": "Google",
    "url": "https://google.com"
  },
  "version": "1.0.0",
  "authentication": {
    "schemes": "OAuth2"
  },
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/plain", "application/html"],
  "capabilities": {
    "streaming": true,
    "pushNotifications": false
  },
  "skills": [
    {
      "id": "route-planner",
      "name": "Route planning",
      "description": "Helps plan routing between two locations",
      "tags": ["maps", "routing", "navigation"],
      "examples": [
        "plan my route from Sunnyvale to Mountain View",
        "what's the commute time from Sunnyvale to San Francisco at 9AM",
        "create turn by turn directions from Sunnyvale to Mountain View"
      ],
      // can return a video of the route
      "outputModes": ["application/html", "video/mp4"]
    },
    {
      "id": "custom-map",
      "name": "My Map",
      "description": "Manage a custom map with your own saved places",
      "tags": ["custom-map", "saved-places"],
      "examples": [
        "show me my favorite restaurants on the map",
        "create a visual of all places I've visited in the past year"
      ],
      "outputModes": ["application/html"]
    }
  ]
}
```

Allows a client to send content to a remote agent to start a new Task, resume an interrupted Task, or reopen a completed Task. A Task interrupt may be caused by an agent requiring additional user input or a runtime error.

**Request:**

```
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks/send",
  "params": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "tell me a joke"
        }
      ]
    },
    "metadata": {}
  }
}
```

**Response:**

```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "sessionId": "c295ea44-7543-4f78-b524-7a38915ad6e4",
    "status": {
      "state": "completed"
    },
    "artifacts": [
      {
        "name": "joke",
        "parts": [
          {
            "type": "text",
            "text": "Why did the chicken cross the road? To get to the other side!"
          }
        ]
      }
    ],
    "metadata": {}
  }
}
```

Clients may use this method to retrieve the generated Artifacts for a Task. The agent determines the retention window for Tasks previously submitted to it. An agent may return an error code for Tasks that were past the retention window or for Tasks that are short-lived and not persisted.

The client may also request the last N items of history for the Task, which will include all Messages, in order, sent by the client and server. By default, this is 0 (no history).

**Request:**

```
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks/get",
  "params": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "historyLength": 10,
    "metadata": {}
  }
}
```

**Response:**

```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "sessionId": "c295ea44-7543-4f78-b524-7a38915ad6e4",
    "status": {
      "state": "completed"
    },
    "artifacts": [
      {
        "parts": [
          {
            "type": "text",
            "text": "Why did the chicken cross the road? To get to the other side!"
          }
        ]
      }
    ],
    "history": [
      {
        "role": "user",
        "parts": [
          {
            "type": "text",
            "text": "tell me a joke"
          }
        ]
      }
    ],
    "metadata": {}
  }
}
```

A client may choose to cancel previously submitted Tasks.

**Request:**

```
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks/cancel",
  "params": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "metadata": {}
  }
}
```

**Response:**

```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "sessionId": "c295ea44-7543-4f78-b524-7a38915ad6e4",
    "status": {
      "state": "canceled"
    },
    "metadata": {}
  }
}
```

Clients may configure a push notification URL for receiving an update on Task status change.

**Request:**

```
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks/pushNotification/set",
  "params": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "pushNotificationConfig": {
      "url": "https://example.com/callback",
      "authentication": {
        "schemes": ["jwt"]
      }
    }
  }
}
```

**Response:**

```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "pushNotificationConfig": {
      "url": "https://example.com/callback",
      "authentication": {
        "schemes": ["jwt"]
      }
    }
  }
}
```

Clients may retrieve the currently configured push notification configuration for a Task using this method.

**Request:**

```
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks/pushNotification/get",
  "params": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64"
  }
}
```

**Response:**

```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "pushNotificationConfig": {
      "url": "https://example.com/callback",
      "authentication": {
        "schemes": ["jwt"]
      }
    }
  }
}
```

### Multi-turn Conversations

A Task may pause execution on the remote agent if it requires additional user input. When a Task is in the `input-required` state, the client must provide additional input for the Task to resume processing.

The Message included in the `input-required` state must include details indicating what the client must do (e.g., "fill out a form", "log into SaaS service foo"). If this includes structured data, the instruction should be sent as one `Part` and the structured data as a second `Part`.

**Request (Sequence 1):**

```
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks/send",
  "params": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "request a new phone for me"
        }
      ]
    },
    "metadata": {}
  }
}
```

**Response (Sequence 2 - Input Required):**

```
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "sessionId": "c295ea44-7543-4f78-b524-7a38915ad6e4",
    "status": {
      "state": "input-required",
      "message": {
        "role": "agent",
        "parts": [
          {
            "type": "text",
            "text": "Select a phone type (iPhone/Android)"
          }
        ]
      }
    },
    "metadata": {}
  }
}
```

**Request (Sequence 3 - Providing Input):**

```
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tasks/send",
  "params": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "sessionId": "c295ea44-7543-4f78-b524-7a38915ad6e4",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "Android"
        }
      ]
    },
    "metadata": {}
  }
}
```

**Response (Sequence 4 - Completion):**

```
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "sessionId": "c295ea44-7543-4f78-b524-7a38915ad6e4",
    "status": {
      "state": "completed"
    },
    "artifacts": [
      {
        "name": "order-confirmation",
        "parts": [
          {
            "type": "text",
            "text": "I have ordered a new Android device for you. Your request number is R12443"
          }
        ],
        "metadata": {}
      }
    ],
    "metadata": {}
  }
}
```

### Streaming Support

For clients and remote agents capable of communicating over HTTP with Server-Sent Events (SSE), clients can send the RPC request with method `tasks/sendSubscribe` when creating a new Task. The remote agent can respond with a stream of `TaskStatusUpdateEvents` (to communicate status changes or instructions/requests) and `TaskArtifactUpdateEvents` (to stream generated results).

Note that `TaskArtifactUpdateEvents` can append new parts to existing Artifacts. Clients can use `tasks/get` to retrieve the entire Artifact outside of the streaming context. Agents must set the `final: true` attribute at the end of the stream or if the agent is interrupted and requires additional user input.

**Request:**

**Response (SSE Stream):**

```
data: {
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "status": {
      "state": "working",
      "timestamp":"2025-04-02T16:59:25.331844"
    },
    "final": false
  }
}

data: {
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "artifact": {
      "parts": [
        {"type":"text", "text": "<section 1...>"}
      ],
      "index": 0,
      "append": false,
      "lastChunk": false
    }
  }
}

data: {
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "artifact": {
      "parts": [
        {"type":"text", "text": "<section 2...>"}
      ],
      "index": 0,
      "append": true,
      "lastChunk": false
    }
  }
}

data: {
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": 1,
    "artifact": {
      "parts": [
        {"type":"text", "text": "<section 3...>"}
      ],
      "index": 0,
      "append": true,
      "lastChunk": true
    }
  }
}

data: {
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": 1,
    "status": {
      "state": "completed",
      "timestamp":"2025-04-02T16:59:35.331844"
    },
    "final": true
  }
}
```

A disconnected client may resubscribe to a remote agent that supports streaming to receive Task updates via SSE.

**Request:**

**Response (SSE Stream):**

```
data: {
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "artifact": {
      "parts": [
        {"type":"text", "text": "<section 2...>"}
      ],
      "index": 0,
      "append": true,
      "lastChunk":false
    }
  }
}

data: {
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "artifact": {
      "parts": [
        {"type":"text", "text": "<section 3...>"}
      ],
      "index": 0,
      "append": true,
      "lastChunk": true
    }
  }
}

data: {
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "status": {
      "state": "completed",
      "timestamp":"2025-04-02T16:59:35.331844"
    },
    "final": true
  }
}
```

### Non-textual Media

The following example demonstrates an interaction between a client and an agent involving non-textual data (a PDF file).

**Request (Sequence 1 - Send File):**

```
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "tasks/send",
  "params": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "sessionId": "c295ea44-7543-4f78-b524-7a38915ad6e4",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "Analyze the attached report and generate high level overview"
        },
        {
          "type": "file",
          "file": {
            "mimeType": "application/pdf",
            "data": "<base64-encoded-content>"
          }
        }
      ]
    },
    "metadata": {}
  }
}
```

**Response (Sequence 2 - Acknowledgment/Working):**

```
{
  "jsonrpc": "2.0",
  "id": 9,
  "result": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "sessionId": "c295ea44-7543-4f78-b524-7a38915ad6e4",
    "status": {
      "state": "working",
      "message": {
        "role": "agent",
        "parts": [
          {
            "type": "text",
            "text": "analysis in progress, please wait"
          }
        ],
        "metadata": {}
      }
    },
    "metadata": {}
  }
}
```

**Request (Sequence 3 - Get Result):**

```
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tasks/get",
  "params": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "metadata": {}
  }
}
```

**Response (Sequence 4 - Completed with Analysis):**

```
{
  "jsonrpc": "2.0",
  "id": 9,
  "result": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "sessionId": "c295ea44-7543-4f78-b524-7a38915ad6e4",
    "status": {
      "state": "completed"
    },
    "artifacts": [
      {
        "parts": [
          {
            "type": "text",
            "text": "<generated analysis content>"
          }
        ],
        "metadata": {}
      }
    ],
    "metadata": {}
  }
}
```

### Structured Output

Both the client and the agent can request structured output from the other party by specifying a `mimeType` and `schema` in the `metadata` of a `Part`.

**Request (Requesting JSON Output):**

```
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "tasks/send",
  "params": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "sessionId": "c295ea44-7543-4f78-b524-7a38915ad6e4",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "Show me a list of my open IT tickets",
          "metadata": {
            "mimeType": "application/json",
            "schema": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "ticketNumber": { "type": "string" },
                  "description": { "type": "string" }
                }
              }
            }
          }
        }
      ]
    },
    "metadata": {}
  }
}
```

**Response (Providing JSON Output):**

```
{
  "jsonrpc": "2.0",
  "id": 9,
  "result": {
    "id": "de38c76d-d54c-436c-8b9f-4c2703648d64",
    "sessionId": "c295ea44-7543-4f78-b524-7a38915ad6e4",
    "status": {
      "state": "completed",
      "timestamp": "2025-04-17T17:47:09.680794"
    },
    "artifacts": [
      {
        "parts": [
          {
            "type": "text",
            "text": "[{\"ticketNumber\":\"REQ12312\",\"description\":\"request for VPN access\"},{\"ticketNumber\":\"REQ23422\",\"description\":\"Add to DL - team-gcp-onboarding\"}]"
          }
        ],
        "index": 0
      }
    ]
  }
}
```

### Error Handling

Following is the `ErrorMessage` format for the server to respond to the client when it encounters an error processing the client request.

```
interface ErrorMessage {
  code: number;
  message: string;
  data?: any;
}
```

The following are the standard JSON-RPC error codes that the server can respond with for error scenarios:

| Error Code | Message | Description |
| --- | --- | --- |
| `-32700` | JSON parse error | Invalid JSON was sent |
| `-32600` | Invalid Request | Request payload validation error |
| `-32601` | Method not found | Not a valid method |
| `-32602` | Invalid params | Invalid method parameters |
| `-32603` | Internal error | Internal JSON-RPC error |
| `-32000` to `-32099` | Server error | Reserved for implementation specific error codes |
| `-32001` | Task not found | Task not found with the provided id |
| `-32002` | Task cannot be canceled | Task cannot be canceled by the remote agent |
| `-32003` | Push notifications not supported | Push Notification is not supported by the agent |
| `-32004` | Unsupported operation | Operation is not supported |
| `-32005` | Incompatible content types | Incompatible content types between client and an agent |

**Example**
```json
// Sample Agent Card
{
  "name": "Google Maps Agent",
  "description": "Plan routes, remember places, and generate directions",
  "url": "https://maps-agent.google.com",
  "provider": {
    "organization": "Google",
    "url": "https://google.com"
  },
  "version": "1.0.0",
  "authentication": {
    "schemes": ["OAuth2"]
  },
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/plain", "application/html"],
  "capabilities": {
    "streaming": true,
    "pushNotifications": false
  },
  "skills": [
    {
      "id": "route-planner",
      "name": "Route planning",
      "description": "Helps plan routing between two locations",
      "tags": ["maps", "routing", "navigation"],
      "examples": ["plan my route from Sunnyvale to Mountain View"]
    }
  ]
}
```

```json
// Send a Task Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks/send",
  "params": {
    "id": "task-123",
    "message": {
      "role": "user",
      "parts": [{"type": "text", "text": "tell me a joke"}]
    },
    "metadata": {}
  }
}
```

```json
// Sample Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "id": "task-123",
    "sessionId": "session-456",
    "status": {"state": "completed"},
    "artifacts": [{"name": "joke", "parts": [{"type": "text", "text": "Why did the chicken cross the road? To get to the other side!"}]}],
    "metadata": {}
  }
}
```

```json
// Cancel a Task
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tasks/cancel",
  "params": {"id": "task-123", "metadata": {}}
}
```

This example shows how a client can interact with a remote agent to send a task, receive results, and cancel if necessary, following the A2A protocol.