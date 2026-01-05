import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function SMSLogin() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const utils = trpc.useUtils();

  const sendCode = trpc.sms.sendCode.useMutation({
    onSuccess: () => {
      toast.success("Verification code sent!");
      setStep("code");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send code");
    },
  });

  const verifyCode = trpc.sms.verifyCode.useMutation({
    onSuccess: async () => {
      toast.success("Login successful!");
      // Invalidate auth cache to force fresh data
      await utils.auth.me.invalidate();
      // Wait a moment for cookie to be set, then redirect to agent
      setTimeout(() => {
        window.location.href = "/agent";
      }, 100);
    },
    onError: (error) => {
      toast.error(error.message || "Invalid code");
    },
  });

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (phone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    sendCode.mutate({ phone });
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }
    verifyCode.mutate({ phone, code, name });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">vazal.ai</h1>
          <p className="text-muted-foreground">
            {step === "phone" ? "Enter your phone number" : "Enter verification code"}
          </p>
        </div>

        {step === "phone" ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">
                Phone Number
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 234 567 8900"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={sendCode.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Include country code (e.g., +41 for Switzerland)
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={sendCode.isPending}
            >
              {sendCode.isPending ? "Sending..." : "Send Code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium">
                Verification Code
              </label>
              <Input
                id="code"
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={verifyCode.isPending}
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Check your phone for the 6-digit code
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={verifyCode.isPending}
            >
              {verifyCode.isPending ? "Verifying..." : "Verify & Login"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setStep("phone");
                setCode("");
              }}
              disabled={verifyCode.isPending}
            >
              Change Phone Number
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
