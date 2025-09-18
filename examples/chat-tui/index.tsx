import { useState, useEffect, useCallback } from "react";
import { render, Text, Box, useInput } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import { Database } from "bun:sqlite";
import { ErebusClient, ErebusClientState } from "@erebus-sh/sdk/client";
import { createGenericAdapter } from "@erebus-sh/sdk/server";
import { Access, ErebusService } from "@erebus-sh/sdk/service";

// Configuration
let port = Math.floor(Math.random() * 10000) + 4000; // 4000-5000
const WS_BASE_URL = process.env.WS_BASE_URL || "ws://localhost:8787";
const SECRET_API_KEY =
  process.env.SECRET_API_KEY ||
  "dv-er-a9ti6g5fnybi2mug3t5mi5o7w27121ehxsy8l6nf5xijxzu4";

// Erebus client
const client = ErebusClient.createClient({
  client: ErebusClientState.PubSub,
  authBaseUrl: `http://localhost:${port}`,
  wsBaseUrl: WS_BASE_URL,
});

// Database setup
const database = new Database(":memory:");

// Initialize database schema
database.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    user TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats (id)
  );
  
  INSERT OR IGNORE INTO users (username, password) VALUES ('user', 'user');
`);

// In-memory session store for TUI
const sessionStore = new Map<
  string,
  { userId: string; username: string; lastActivity: number }
>();
let currentUserId: string | null = null;

// Session cleanup function
const cleanupExpiredSessions = () => {
  const now = Date.now();
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  for (const [userId, session] of sessionStore.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      sessionStore.delete(userId);
      if (currentUserId === userId) {
        currentUserId = null;
      }
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

// Types
interface User {
  id: string;
  username: string;
}

interface Chat {
  id: string;
  name: string;
  created_at: string;
}

interface Message {
  id: string;
  chat_id: string;
  user: string;
  content: string;
  created_at: string;
}

// Login Component
const LoginScreen = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = useCallback(async () => {
    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    const req = new Request(`http://localhost:${port}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ username }),
    });
    const res = await fetch(req);
    const { username: loggedInUsername } = (await res.json()) as {
      username: string;
    };

    if (loggedInUsername) {
      onLogin({ id: loggedInUsername, username: loggedInUsername });
    } else {
      setError("Invalid credentials");
    }
  }, [username, onLogin]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="cyan" bold>
        Welcome to Chat TUI
      </Text>
      <Box height={1} />
      <Text color="yellow">Username:</Text>
      <TextInput
        value={username}
        onChange={setUsername}
        onSubmit={handleSubmit}
        placeholder="Enter username"
      />

      {error && (
        <>
          <Box height={1} />
          <Text color="red">{error}</Text>
        </>
      )}
      <Box height={1} />
      <Text color="gray">Press Enter to continue</Text>
    </Box>
  );
};

// Sidebar Component
const Sidebar = ({
  chats,
  onSelectChat,
  onLogout,
}: {
  chats: Chat[];
  onSelectChat: (chat: Chat) => void;
  onLogout: () => void;
}) => {
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [newChatName, setNewChatName] = useState("");

  const handleCreateChat = useCallback(() => {
    if (newChatName.trim()) {
      const stmt = database.prepare("INSERT INTO chats (name) VALUES (?)");
      const result = stmt.run(newChatName.trim());
      const newChat = database
        .prepare("SELECT * FROM chats WHERE id = ?")
        .get(result.lastInsertRowid.toString()) as Chat;
      onSelectChat(newChat);
      setNewChatName("");
      setIsCreatingChat(false);
    }
  }, [newChatName, onSelectChat]);

  const chatOptions = chats.map((chat) => ({
    label: chat.name,
    value: chat.id.toString(),
  }));

  const handleSelect = useCallback(
    (option: { label: string; value: string }) => {
      const chat = chats.find((c) => c.id === option.value);
      if (chat) {
        onSelectChat(chat);
      }
    },
    [chats, onSelectChat],
  );

  useEffect(() => {
    async function connect() {
      client.joinChannel("chats");
      await client.connect();
    }
    connect();
  }, [chats]);

  useInput((input, key) => {
    if (key.ctrl && input === "n") {
      setIsCreatingChat(true);
    }
    if (key.ctrl && input === "q") {
      onLogout();
    }
  });

  if (isCreatingChat) {
    return (
      <Box
        flexDirection="column"
        padding={1}
        width={30}
        borderStyle="round"
        borderColor="cyan"
      >
        <Text color="cyan" bold>
          Create New Chat
        </Text>
        <Box height={1} />
        <Text color="yellow">Chat Name:</Text>
        <TextInput
          value={newChatName}
          onChange={setNewChatName}
          onSubmit={handleCreateChat}
          placeholder="Enter chat name"
        />
        <Box height={1} />
        <Text color="gray">Press Enter to create, Ctrl+C to cancel</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      padding={1}
      width={30}
      borderStyle="round"
      borderColor="cyan"
    >
      <Text color="cyan" bold>
        Chats
      </Text>
      <Box height={1} />
      {chats.length > 0 ? (
        <SelectInput items={chatOptions} onSelect={handleSelect} />
      ) : (
        <Text color="gray">No chats yet</Text>
      )}
      <Box height={1} />
      <Text color="yellow">Ctrl+N: New Chat</Text>
      <Text color="yellow">Ctrl+Q: Logout</Text>
    </Box>
  );
};

// Chat Component
const ChatView = ({ chat, onBack }: { chat: Chat; onBack: () => void }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    const loadMessages = () => {
      const chatMessages = database
        .prepare(
          "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC",
        )
        .all(chat.id) as Message[];
      setMessages(chatMessages);
    };

    loadMessages();

    client.subscribe(chat.name, (message) => {
      try {
        const user = message.senderId;

        // Only add message if it's not from the current user (to avoid duplicates from optimistic updates)
        if (user !== currentUserId) {
          const insert = database.prepare(
            "INSERT INTO messages (chat_id, user, content) VALUES (?, ?, ?)",
          );
          insert.run(chat.id, user, message.payload);
          loadMessages();
        }
      } catch (err) {
        // noop
      }
    });

    // Refresh messages every second
    const interval = setInterval(loadMessages, 1000);
    return () => {
      client.unsubscribe(chat.name);

      clearInterval(interval);
    };
  }, [chat.id]);

  const handleSendMessage = useCallback(async () => {
    if (newMessage.trim()) {
      const messageContent = newMessage.trim();
      const currentUser = (currentUserId as string) || "";
      const timestamp = new Date().toISOString();

      // Create optimistic message object
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`, // Temporary ID
        chat_id: chat.id,
        user: currentUser,
        content: messageContent,
        created_at: timestamp,
      };

      // Add message to UI immediately (optimistic update)
      setMessages((prev) => [...prev, optimisticMessage]);
      setNewMessage("");

      // Save to database and publish in background
      try {
        const stmt = database.prepare(
          "INSERT INTO messages (chat_id, user, content) VALUES (?, ?, ?)",
        );
        const result = stmt.run(chat.id, currentUser, messageContent);

        // Update the optimistic message with real database ID
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === optimisticMessage.id
              ? { ...msg, id: result.lastInsertRowid.toString() }
              : msg,
          ),
        );

        await client.publishWithAck({
          topic: chat.name,
          messageBody: messageContent,
          onAck: (ack) => {
            // console.log("[chat view] ack", ack.ack);
          },
          timeoutMs: 10000,
        });
      } catch (error) {
        // If save fails, remove the optimistic message and show error
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== optimisticMessage.id),
        );
        console.error("Failed to save message:", error);
        // You could add a toast/notification here to show the error to the user
      }
    }
  }, [newMessage, chat.id]);

  useInput((input, key) => {
    if (key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1} padding={1}>
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Text color="cyan" bold>
          {chat.name}
        </Text>
        <Text color="gray">Press Esc to go back</Text>
      </Box>

      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="round"
        borderColor="gray"
        padding={1}
        marginBottom={1}
      >
        {messages.length > 0 ? (
          messages.map((message) => (
            <Box key={message.id} marginBottom={1}>
              <Text color="green">
                {new Date(message.created_at).toLocaleTimeString()}
              </Text>
              <Text>
                {" "}
                {message.user}: {message.content}
              </Text>
            </Box>
          ))
        ) : (
          <Text color="gray">No messages yet. Start the conversation!</Text>
        )}
      </Box>

      <Box flexDirection="row">
        <Text color="yellow">Message: </Text>
        <Box flexGrow={1}>
          <TextInput
            value={newMessage}
            onChange={setNewMessage}
            onSubmit={handleSendMessage}
            placeholder="Type your message..."
          />
        </Box>
      </Box>
    </Box>
  );
};

// Main App Component
const TUI = () => {
  const [user, setUser] = useState<User | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  useEffect(() => {
    if (user) {
      const allChats = database
        .prepare("SELECT * FROM chats ORDER BY created_at DESC")
        .all() as Chat[];
      setChats(allChats);
    }
  }, [user]);

  const handleLogin = useCallback((loggedInUser: User) => {
    setUser(loggedInUser);
    // Store session in memory for TUI
    currentUserId = loggedInUser.id;
    sessionStore.set(loggedInUser.id, {
      userId: loggedInUser.id,
      username: loggedInUser.username,
      lastActivity: Date.now(),
    });
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setSelectedChat(null);
    setChats([]);
    // Clear session from memory
    if (currentUserId) {
      sessionStore.delete(currentUserId);
      currentUserId = null;
    }
  }, []);

  const handleSelectChat = useCallback((chat: Chat) => {
    setSelectedChat(chat);
  }, []);

  const handleBackToSidebar = useCallback(() => {
    setSelectedChat(null);
  }, []);

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (selectedChat) {
    return <ChatView chat={selectedChat} onBack={handleBackToSidebar} />;
  }

  return (
    <Box flexDirection="row" height="100%">
      <Sidebar
        chats={chats}
        onSelectChat={handleSelectChat}
        onLogout={handleLogout}
      />
      <Box
        flexDirection="column"
        flexGrow={1}
        padding={1}
        justifyContent="center"
        alignItems="center"
      >
        <Text color="cyan" bold>
          Welcome, {user.username}!
        </Text>
        <Box height={1} />
        <Text color="gray">
          Select a chat from the sidebar or create a new one
        </Text>
      </Box>
    </Box>
  );
};

render(<TUI />);

const app = createGenericAdapter({
  authorize: async (channel: string, ctx: { req: Request }) => {
    // Get authenticated user from in-memory session store
    if (!currentUserId) {
      throw new Error("No active session found. Please login first.");
    }

    const sessionData = sessionStore.get(currentUserId);
    if (!sessionData) {
      throw new Error("Session expired or not found. Please login again.");
    }

    // Update last activity
    sessionData.lastActivity = Date.now();

    const service = new ErebusService({
      secret_api_key: SECRET_API_KEY,
      base_url: "http://localhost:3000",
    });

    // Prepare the session and create instance of ErebusSession
    const session = await service.prepareSession({
      userId: sessionData.userId,
    });

    // First join the channel | use the channel passed by the client or force a channel name
    session.join(channel);

    // Then allow the topic, for this example we allow all topics
    session.allow("*", Access.ReadWrite);

    return session;
  },
  fireWebhook: async (webHookMessage) => {
    // noop
  },
});

Bun.serve({
  port: port,
  routes: {
    "/login": {
      POST: async (req) => {
        const bunReq = req;
        const cookies = bunReq.cookies;

        // Very secure authentication :P
        const { username } = (await bunReq.json()) as { username: string };

        cookies.set("x-user-id", username, {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/",
        });

        const response = Response.json({ success: true, username });

        return response;
      },
    },
  },
  fetch: (req: Request) => {
    // Inject current user session into the request context
    // This allows the authorize handler to access the current user
    const modifiedReq = new Request(req, {
      headers: {
        ...Object.fromEntries(req.headers.entries()),
        "x-current-user-id": currentUserId || "",
        "x-current-username": currentUserId
          ? sessionStore.get(currentUserId)?.username || ""
          : "",
      },
    });
    return app.fetch(modifiedReq);
  },
});
