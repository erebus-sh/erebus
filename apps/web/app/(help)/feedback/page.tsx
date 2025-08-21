"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  Send,
  MessageCircle,
  Bug,
  Lightbulb,
  HelpCircle,
  Mail,
} from "lucide-react";
import Link from "next/link";

const feedbackTypes = [
  {
    value: "bug",
    label: "Bug Report",
    icon: Bug,
    description: "Report a problem or issue you've encountered",
  },
  {
    value: "feature",
    label: "Feature Request",
    icon: Lightbulb,
    description: "Suggest a new feature or improvement",
  },
  {
    value: "general",
    label: "General Feedback",
    icon: MessageCircle,
    description: "Share your thoughts or experience",
  },
  {
    value: "help",
    label: "Help & Support",
    icon: HelpCircle,
    description: "Get help or ask a question",
  },
];

export default function FeedbackPage() {
  const [feedbackType, setFeedbackType] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Reset form
    setFeedbackType("");
    setEmail("");
    setMessage("");
    setIsSubmitting(false);

    // You can integrate with your backend here
    console.log("Feedback submitted:", { feedbackType, email, message });
  };

  const selectedFeedbackType = feedbackTypes.find(
    (type) => type.value === feedbackType,
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Share Your Feedback
          </h1>
          <p className="text-muted-foreground">
            Help us improve by sharing your thoughts, reporting bugs, or
            suggesting new features.
          </p>
        </div>

        {/* Feedback Form */}
        <Card className="border-border/40 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send us your feedback
            </CardTitle>
            <CardDescription>
              We value your input and will review all submissions carefully.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Feedback Type Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  What type of feedback is this?
                </Label>
                <RadioGroup
                  value={feedbackType}
                  onValueChange={setFeedbackType}
                  className="grid grid-cols-1 gap-3"
                >
                  {feedbackTypes.map((type) => {
                    const IconComponent = type.icon;
                    return (
                      <div
                        key={type.value}
                        className="flex items-center space-x-3"
                      >
                        <RadioGroupItem value={type.value} id={type.value} />
                        <Label
                          htmlFor={type.value}
                          className={cn(
                            "flex items-center gap-2 flex-1 p-3 rounded-lg border cursor-pointer transition-colors",
                            feedbackType === type.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50",
                          )}
                        >
                          <IconComponent className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{type.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {type.description}
                            </div>
                          </div>
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </div>

              {/* Email (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email address{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="transition-colors"
                />
                <p className="text-xs text-muted-foreground">
                  Provide your email if you want us to follow up on your
                  feedback.
                </p>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-medium">
                  Your message
                </Label>
                <Textarea
                  id="message"
                  placeholder={
                    selectedFeedbackType
                      ? `Please describe your ${selectedFeedbackType.label.toLowerCase()} in detail...`
                      : "Please provide details about your feedback..."
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[120px] transition-colors"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Be as specific as possible to help us understand your feedback
                  better.
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={!feedbackType || !message.trim() || isSubmitting}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Sending...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Send Feedback
                  </div>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <div className="w-1 h-1 bg-muted-foreground rounded-full" />
            <Link
              href="/terms"
              className="hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            <div className="w-1 h-1 bg-muted-foreground rounded-full" />
            <Link
              href="/support"
              className="hover:text-foreground transition-colors"
            >
              Support
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            We typically respond within 24-48 hours. Thank you for helping us
            improve!
          </p>
        </div>
      </div>
    </div>
  );
}
