import { TopicProvider } from "@erebus-sh/sdk/react";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  {
    /*
 Wrap the path where you want to use Erebus in TopicProvider
 Think of it as a room inside a channel
 You can set the topic to whatever fits your app
 If the user is not allowed to read the channel they cannot subscribe to its topics
 */
  }
  return <TopicProvider topic="room123">{children}</TopicProvider>;
}
