import { useState, useEffect, useCallback } from "react";
import { render, Text, Box, useInput } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import { Database } from "bun:sqlite";
import { ErebusClient, ErebusClientState } from "@erebus-sh/sdk/client";
import { createGenericAdapter } from "@erebus-sh/sdk/server";
import { Access, ErebusService } from "@erebus-sh/sdk/service";
import type { BunRequest } from "bun";

// Erebus client
const client = ErebusClient.createClientSync({
  client: ErebusClientState.PubSub,
  authBaseUrl: "http://localhost:3000",
  wsBaseUrl: "ws://localhost:3000",
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
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats (id)
  );
  
  INSERT OR IGNORE INTO users (username, password) VALUES ('user', 'user');
`);

// Types
interface User {
  id: number;
  username: string;
}

interface Chat {
  id: number;
  name: string;
  created_at: string;
}

interface Message {
  id: number;
  chat_id: number;
  content: string;
  created_at: string;
}

// Login Component
const LoginScreen = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPasswordMode, setIsPasswordMode] = useState(false);

  const handleSubmit = useCallback(() => {
    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    if (!isPasswordMode) {
      setIsPasswordMode(true);
      return;
    }

    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    // Check credentials
    const user = database
      .prepare("SELECT * FROM users WHERE username = ? AND password = ?")
      .get(username, password) as User | undefined;

    if (user) {
      onLogin(user);
    } else {
      setError("Invalid credentials");
      setPassword("");
    }
  }, [username, password, isPasswordMode, onLogin]);

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
      {isPasswordMode && (
        <>
          <Box height={1} />
          <Text color="yellow">Password:</Text>
          <TextInput
            value={password}
            onChange={setPassword}
            onSubmit={handleSubmit}
            placeholder="Enter password"
            mask="*"
          />
        </>
      )}
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
  onCreateChat,
  onLogout,
}: {
  chats: Chat[];
  onSelectChat: (chat: Chat) => void;
  onCreateChat: () => void;
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
        .get(result.lastInsertRowid) as Chat;
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
      const chat = chats.find((c) => c.id === parseInt(option.value));
      if (chat) {
        onSelectChat(chat);
      }
    },
    [chats, onSelectChat],
  );

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
      setMessages((prev) => [...prev, message]);
    });

    // Refresh messages every second
    const interval = setInterval(loadMessages, 1000);
    return () => {
      client.unsubscribe(chat.name);

      clearInterval(interval);
    };
  }, [chat.id]);

  const handleSendMessage = useCallback(() => {
    if (newMessage.trim()) {
      const stmt = database.prepare(
        "INSERT INTO messages (chat_id, content) VALUES (?, ?)",
      );
      stmt.run(chat.id, newMessage.trim());
      setNewMessage("");
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
              <Text> {message.content}</Text>
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
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setSelectedChat(null);
    setChats([]);
  }, []);

  const handleSelectChat = useCallback((chat: Chat) => {
    setSelectedChat(chat);
  }, []);

  const handleCreateChat = useCallback(() => {
    // This will be handled by the Sidebar component
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
        onCreateChat={handleCreateChat}
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

const app = createGenericAdapter<BunRequest>({
  authorize: async (channel, ctx) => {
    // Extract user ID from cookies for proper authorization
    const userId = ctx.req.cookies.get("x-user-id") || "1";

    const service = new ErebusService({
      secret_api_key: "dv-er-4o7j90qw39p96bra19fa94prupp6vdcg9axrd3hg4hqy68c1",
      base_url: "http://localhost:3000",
    });

    // Prepare the session and create instance of ErebusSession
    const session = await service.prepareSession({
      userId,
    });

    // First join the channel
    session.join(channel);

    // Then allow the topic
    session.allow("test_topic", Access.ReadWrite);

    return session;
  },
  fireWebhook: async (webHookMessage) => {
    console.log(webHookMessage);
  },
});

Bun.serve({
  port: 3000,
  routes: {
    "/login": {
      POST: async (req) => {
        const bunReq = req;
        const cookies = bunReq.cookies;
        cookies.set("x-user-id", "1");
        return Response.json({ success: true });
      },
    },
  },
  fetch: (req) => app.fetch(req as BunRequest),
});
