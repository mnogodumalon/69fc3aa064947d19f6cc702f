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
const APP_ID = '69fc3a76a7c5acf5e5c9e86e';
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

export default function PublicFormZimmerverwaltung() {
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
          <h1 className="text-2xl font-bold text-foreground">Zimmerverwaltung — Formular</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-6 shadow-md">
          <div className="space-y-2">
            <Label htmlFor="zimmer_name">Zimmername / -nummer</Label>
            <Input
              id="zimmer_name"
              value={fields.zimmer_name ?? ''}
              onChange={e => setFields(f => ({ ...f, zimmer_name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zimmer_typ">Zimmertyp</Label>
            <Select
              value={lookupKey(fields.zimmer_typ) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, zimmer_typ: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="zimmer_typ"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="einzelzimmer">Einzelzimmer</SelectItem>
                <SelectItem value="doppelzimmer">Doppelzimmer</SelectItem>
                <SelectItem value="suite">Suite</SelectItem>
                <SelectItem value="freigehege">Freigehege</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kapazitaet">Kapazität (Anzahl Katzen)</Label>
            <Input
              id="kapazitaet"
              type="number"
              value={fields.kapazitaet ?? ''}
              onChange={e => setFields(f => ({ ...f, kapazitaet: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tagespreis">Tagespreis (€)</Label>
            <Input
              id="tagespreis"
              type="number"
              value={fields.tagespreis ?? ''}
              onChange={e => setFields(f => ({ ...f, tagespreis: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="beschreibung">Beschreibung</Label>
            <Textarea
              id="beschreibung"
              value={fields.beschreibung ?? ''}
              onChange={e => setFields(f => ({ ...f, beschreibung: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ausstattung">Ausstattung</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ausstattung_kletterbaum"
                  checked={lookupKeys(fields.ausstattung).includes('kletterbaum')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.ausstattung);
                      const next = checked ? [...current, 'kletterbaum'] : current.filter(k => k !== 'kletterbaum');
                      return { ...f, ausstattung: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="ausstattung_kletterbaum" className="font-normal">Kletterbaum</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ausstattung_fensterplatz"
                  checked={lookupKeys(fields.ausstattung).includes('fensterplatz')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.ausstattung);
                      const next = checked ? [...current, 'fensterplatz'] : current.filter(k => k !== 'fensterplatz');
                      return { ...f, ausstattung: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="ausstattung_fensterplatz" className="font-normal">Fensterplatz</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ausstattung_kuschelhoehle"
                  checked={lookupKeys(fields.ausstattung).includes('kuschelhoehle')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.ausstattung);
                      const next = checked ? [...current, 'kuschelhoehle'] : current.filter(k => k !== 'kuschelhoehle');
                      return { ...f, ausstattung: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="ausstattung_kuschelhoehle" className="font-normal">Kuschelhöhle</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ausstattung_spielzeug"
                  checked={lookupKeys(fields.ausstattung).includes('spielzeug')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.ausstattung);
                      const next = checked ? [...current, 'spielzeug'] : current.filter(k => k !== 'spielzeug');
                      return { ...f, ausstattung: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="ausstattung_spielzeug" className="font-normal">Spielzeug</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ausstattung_heizung"
                  checked={lookupKeys(fields.ausstattung).includes('heizung')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.ausstattung);
                      const next = checked ? [...current, 'heizung'] : current.filter(k => k !== 'heizung');
                      return { ...f, ausstattung: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="ausstattung_heizung" className="font-normal">Heizung</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ausstattung_kameraueberwachung"
                  checked={lookupKeys(fields.ausstattung).includes('kameraueberwachung')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.ausstattung);
                      const next = checked ? [...current, 'kameraueberwachung'] : current.filter(k => k !== 'kameraueberwachung');
                      return { ...f, ausstattung: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="ausstattung_kameraueberwachung" className="font-normal">Kameraüberwachung</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ausstattung_freigehege_zugang"
                  checked={lookupKeys(fields.ausstattung).includes('freigehege_zugang')}
                  onCheckedChange={(checked) => {
                    setFields(f => {
                      const current = lookupKeys(f.ausstattung);
                      const next = checked ? [...current, 'freigehege_zugang'] : current.filter(k => k !== 'freigehege_zugang');
                      return { ...f, ausstattung: next.length ? next as any : undefined };
                    });
                  }}
                />
                <Label htmlFor="ausstattung_freigehege_zugang" className="font-normal">Freigehege-Zugang</Label>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="zimmer_status">Status</Label>
            <Select
              value={lookupKey(fields.zimmer_status) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, zimmer_status: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="zimmer_status"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="verfuegbar">Verfügbar</SelectItem>
                <SelectItem value="belegt">Belegt</SelectItem>
                <SelectItem value="in_reinigung">In Reinigung</SelectItem>
                <SelectItem value="gesperrt">Gesperrt</SelectItem>
              </SelectContent>
            </Select>
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
