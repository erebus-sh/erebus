# Chat TUI

A terminal-based chat application built with Ink (React for CLIs) and Bun SQLite.

## Features

- **Login System**: Hardcoded credentials (username: `user`, password: `user`)
- **Sidebar Navigation**: View all chats and create new ones
- **Chat Rooms**: Create and join chat rooms with persistent message storage
- **Real-time Updates**: Messages refresh automatically every second
- **Keyboard Shortcuts**:
  - `Ctrl+N`: Create new chat
  - `Ctrl+Q`: Logout
  - `Esc`: Go back to sidebar from chat view

## Getting Started

1. Install dependencies:

   ```bash
   bun install
   ```

2. Run the application:
   ```bash
   bun run index.tsx
   ```

## Usage

### Login

- Enter username: `user`
- Enter password: `user`
- Press Enter to submit

### Main Interface

- **Sidebar (left)**: Shows all available chats
- **Main area (right)**: Welcome message or selected chat

### Creating a Chat

- Press `Ctrl+N` to create a new chat
- Enter a chat name
- Press Enter to create and automatically enter the chat

### Chatting

- Select a chat from the sidebar to enter it
- Type messages in the input field at the bottom
- Press Enter to send messages
- Press `Esc` to return to the sidebar

### Navigation

- Use arrow keys to navigate the chat list in the sidebar
- Press Enter to select a chat
- Use keyboard shortcuts for quick actions

## Database

The application uses an in-memory SQLite database with the following schema:

- **users**: Stores user credentials
- **chats**: Stores chat room information
- **messages**: Stores chat messages with timestamps

## Architecture

The application is built with React components using Ink:

- `LoginScreen`: Handles user authentication
- `Sidebar`: Displays chat list and creation interface
- `ChatView`: Shows messages and input for a specific chat
- `TUI`: Main application component managing state and navigation

## Dependencies

- `ink`: React renderer for CLIs
- `ink-text-input`: Text input component
- `ink-select-input`: Select/dropdown component
- `bun:sqlite`: In-memory database
