"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Mail, Phone, Send, Sparkles } from "lucide-react";

import type { LeadRow } from "@/lib/dashboard/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export function OutreachModal({
  lead,
  open,
  onOpenChange,
}: {
  lead: LeadRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Leads");
  const locale = useLocale();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [callHook, setCallHook] = useState("");
  const [to, setTo] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

  // Reset state whenever a new lead opens the modal.
  useEffect(() => {
    if (open && lead) {
      setSubject("");
      setBody("");
      setCallHook("");
      setTo(lead.contact_email ?? "");
      setError(null);
      setSentId(null);
    }
  }, [open, lead]);

  async function generate() {
    if (!lead) return;
    setGenLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: lead.id, locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setSubject(data.subject ?? "");
      setBody(data.body ?? "");
      setCallHook(data.callHook ?? "");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenLoading(false);
    }
  }

  async function send() {
    setSendLoading(true);
    setError(null);
    setSentId(null);
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, text: body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setSentId(data.id ?? "sent");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSendLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-winner" />
            {t("outreachTitle")}
          </DialogTitle>
          <DialogDescription>
            {lead ? lead.name || lead.url : ""}
          </DialogDescription>
        </DialogHeader>

        {/* Call hook + tel: action */}
        <div className="rounded-lg border bg-background/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("callHook")}
            </span>
            {lead?.contact_phone ? (
              <a
                href={`tel:${lead.contact_phone}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-winner hover:underline"
              >
                <Phone className="h-3.5 w-3.5" />
                {lead.contact_phone}
              </a>
            ) : null}
          </div>
          <p className="min-h-[1.25rem] text-sm">
            {callHook || (
              <span className="text-muted-foreground">{t("notGenerated")}</span>
            )}
          </p>
        </div>

        <Button
          type="button"
          variant="winner"
          onClick={generate}
          disabled={genLoading || !lead}
          className="w-full"
        >
          {genLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {t("generate")}
        </Button>

        <Separator />

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="to">{t("recipient")}</Label>
            <Input
              id="to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="owner@store.dz"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject">{t("subject")}</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("subjectPlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">{t("body")}</Label>
            <Textarea
              id="body"
              rows={7}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("bodyPlaceholder")}
            />
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {sentId ? (
          <p className="text-sm text-winner">{t("sent")}</p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            onClick={send}
            disabled={sendLoading || !to || !subject || !body}
          >
            {sendLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4 rtl:rotate-180" />
            )}
            {t("sendEmail")}
          </Button>
          {to ? (
            <Button asChild variant="outline">
              <a
                href={`mailto:${to}?subject=${encodeURIComponent(
                  subject
                )}&body=${encodeURIComponent(body)}`}
              >
                <Mail className="h-4 w-4" />
                {t("openInMail")}
              </a>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
