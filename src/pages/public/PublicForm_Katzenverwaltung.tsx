import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { lookupKey, lookupKeys } from '@/lib/formatters';

// Empty PROXY_BASE → relative URLs (dashboard and form-proxy share the domain).
const PROXY_BASE = '';
const APP_ID = '69fc3a757c67e99597072cbc';
const SUBMIT_PATH = `/rest/apps/${APP_ID}/records`;
const ALTCHA_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/altcha/dist/altcha.min.js';

async function submitPublicForm(fields: Record<string, unknown>, captchaToken: string) {
  const res = await fetch(`${PROXY_BASE}/api${SUBMIT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Captcha-Token': captchaToken,
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Submission failed');
  }
  return res.json();
}


function cleanFields(fields: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (typeof value === 'object' && !Array.isArray(value) && 'key' in (value as any)) {
      cleaned[key] = (value as any).key;
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map(item =>
        typeof item === 'object' && item !== null && 'key' in item ? item.key : item
      );
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export default function PublicFormKatzenverwaltung() {
  const [fields, setFields] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captchaRef = useRef<HTMLElement | null>(null);

  // Load the ALTCHA web component script once per page.
  useEffect(() => {
    if (document.querySelector(`script[src="${ALTCHA_SCRIPT_SRC}"]`)) return;
    const s = document.createElement('script');
    s.src = ALTCHA_SCRIPT_SRC;
    s.defer = true;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    if (qIdx === -1) return;
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    const prefill: Record<string, any> = {};
    params.forEach((value, key) => { prefill[key] = value; });
    if (Object.keys(prefill).length) setFields(prev => ({ ...prefill, ...prev }));
  }, []);

  function readCaptchaToken(): string | null {
    const el = captchaRef.current as any;
    if (!el) return null;
    return el.value || el.getAttribute('value') || null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = readCaptchaToken();
    if (!token) {
      setError('Bitte warte auf die Spam-Prüfung und versuche es erneut.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitPublicForm(cleanFields(fields), token);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Etwas ist schiefgelaufen. Bitte versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Vielen Dank!</h2>
          <p className="text-muted-foreground">Deine Eingabe wurde erfolgreich übermittelt.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setSubmitted(false); setFields({}); }}>
            Weitere Eingabe
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Katzenverwaltung — Formular</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-6 shadow-md">
          <div className="space-y-2">
            <Label htmlFor="katze_name">Name der Katze</Label>
            <Input
              id="katze_name"
              value={fields.katze_name ?? ''}
              onChange={e => setFields(f => ({ ...f, katze_name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rasse">Rasse</Label>
            <Input
              id="rasse"
              value={fields.rasse ?? ''}
              onChange={e => setFields(f => ({ ...f, rasse: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="geburtsdatum">Geburtsdatum</Label>
            <Input
              id="geburtsdatum"
              type="date"
              value={fields.geburtsdatum ?? ''}
              onChange={e => setFields(f => ({ ...f, geburtsdatum: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="geschlecht">Geschlecht</Label>
            <Select
              value={lookupKey(fields.geschlecht) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, geschlecht: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="geschlecht"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="weiblich">Weiblich</SelectItem>
                <SelectItem value="maennlich">Männlich</SelectItem>
                <SelectItem value="unbekannt">Unbekannt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="farbe">Farbe / Markierungen</Label>
            <Input
              id="farbe"
              value={fields.farbe ?? ''}
              onChange={e => setFields(f => ({ ...f, farbe: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kastriert">Kastriert / Sterilisiert</Label>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="kastriert"
                checked={!!fields.kastriert}
                onCheckedChange={(v) => setFields(f => ({ ...f, kastriert: !!v }))}
              />
              <Label htmlFor="kastriert" className="font-normal">Kastriert / Sterilisiert</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="impfstatus">Impfungen</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="impfstatus_tollwut"
                  checked={lookupKeys(fields.impfstatus).includes('tollwut')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.impfstatus);
                      const next = checked ? [...current, 'tollwut'] : current.filter(k => k !== 'tollwut');
                      return { ...f, impfstatus: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="impfstatus_tollwut" className="font-normal">Tollwut</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="impfstatus_katzenseuche"
                  checked={lookupKeys(fields.impfstatus).includes('katzenseuche')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.impfstatus);
                      const next = checked ? [...current, 'katzenseuche'] : current.filter(k => k !== 'katzenseuche');
                      return { ...f, impfstatus: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="impfstatus_katzenseuche" className="font-normal">Katzenseuche</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="impfstatus_katzenschnupfen"
                  checked={lookupKeys(fields.impfstatus).includes('katzenschnupfen')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.impfstatus);
                      const next = checked ? [...current, 'katzenschnupfen'] : current.filter(k => k !== 'katzenschnupfen');
                      return { ...f, impfstatus: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="impfstatus_katzenschnupfen" className="font-normal">Katzenschnupfen</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="impfstatus_leukose"
                  checked={lookupKeys(fields.impfstatus).includes('leukose')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.impfstatus);
                      const next = checked ? [...current, 'leukose'] : current.filter(k => k !== 'leukose');
                      return { ...f, impfstatus: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="impfstatus_leukose" className="font-normal">Leukose</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="impfstatus_sonstige"
                  checked={lookupKeys(fields.impfstatus).includes('sonstige')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.impfstatus);
                      const next = checked ? [...current, 'sonstige'] : current.filter(k => k !== 'sonstige');
                      return { ...f, impfstatus: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="impfstatus_sonstige" className="font-normal">Sonstige</Label>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tierarzt_vorname">Tierarzt Vorname</Label>
            <Input
              id="tierarzt_vorname"
              value={fields.tierarzt_vorname ?? ''}
              onChange={e => setFields(f => ({ ...f, tierarzt_vorname: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tierarzt_nachname">Tierarzt Nachname</Label>
            <Input
              id="tierarzt_nachname"
              value={fields.tierarzt_nachname ?? ''}
              onChange={e => setFields(f => ({ ...f, tierarzt_nachname: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tierarzt_telefon">Tierarzt Telefon</Label>
            <Input
              id="tierarzt_telefon"
              value={fields.tierarzt_telefon ?? ''}
              onChange={e => setFields(f => ({ ...f, tierarzt_telefon: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="medikamente">Medikamente</Label>
            <Textarea
              id="medikamente"
              value={fields.medikamente ?? ''}
              onChange={e => setFields(f => ({ ...f, medikamente: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="allergien">Allergien / Unverträglichkeiten</Label>
            <Textarea
              id="allergien"
              value={fields.allergien ?? ''}
              onChange={e => setFields(f => ({ ...f, allergien: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fuetterung">Fütterungsanweisungen</Label>
            <Textarea
              id="fuetterung"
              value={fields.fuetterung ?? ''}
              onChange={e => setFields(f => ({ ...f, fuetterung: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="verhalten">Verhalten & Besonderheiten</Label>
            <Textarea
              id="verhalten"
              value={fields.verhalten ?? ''}
              onChange={e => setFields(f => ({ ...f, verhalten: e.target.value }))}
              rows={3}
            />
          </div>

          <altcha-widget
            ref={captchaRef as any}
            challengeurl={`${PROXY_BASE}/api/_challenge?path=${encodeURIComponent(SUBMIT_PATH)}`}
            auto="onsubmit"
            hidefooter
          />

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Wird gesendet...' : 'Absenden'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Powered by Klar
        </p>
      </div>
    </div>
  );
}
