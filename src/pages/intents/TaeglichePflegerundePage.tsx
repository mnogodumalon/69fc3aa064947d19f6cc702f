import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  IconPaw,
  IconChevronDown,
  IconChevronUp,
  IconCheck,
  IconArrowRight,
  IconArrowLeft,
  IconRefresh,
  IconClipboardList,
} from '@tabler/icons-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Buchungsverwaltung, Katzenverwaltung } from '@/types/app';

// ---- Types ----

interface CatProtokoll {
  catId: string;
  catName: string;
  fressverhalten: string;
  aktivitaet: string;
  befinden: string;
  medikamente_verabreicht: boolean;
  medikamente_notiz: string;
  beobachtungen: string;
  expanded: boolean;
}

const TODAY = format(new Date(), 'yyyy-MM-dd');

const FRESSVERHALTEN_OPTIONS = LOOKUP_OPTIONS['gesundheitsprotokoll']?.['fressverhalten'] ?? [];
const AKTIVITAET_OPTIONS = LOOKUP_OPTIONS['gesundheitsprotokoll']?.['aktivitaet'] ?? [];
const BEFINDEN_OPTIONS = LOOKUP_OPTIONS['gesundheitsprotokoll']?.['befinden'] ?? [];

// ---- Helper ----

function formatAnreise(raw: string | undefined): string {
  if (!raw) return '–';
  // datetimeminute format: YYYY-MM-DDTHH:MM
  const datepart = raw.split('T')[0];
  if (!datepart) return raw;
  const [y, m, d] = datepart.split('-');
  return `${d}.${m}.${y}`;
}

function getKundeName(buchung: Buchungsverwaltung, kundenverwaltungMap: Map<string, { fields: { vorname?: string; nachname?: string } }>): string {
  const kundeId = extractRecordId(buchung.fields.kunde);
  if (!kundeId) return '–';
  const kunde = kundenverwaltungMap.get(kundeId);
  if (!kunde) return kundeId.slice(0, 8) + '…';
  const { vorname, nachname } = kunde.fields;
  return [vorname, nachname].filter(Boolean).join(' ') || kundeId.slice(0, 8) + '…';
}

// ---- Main Component ----

export default function TaeglichePflegerundePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse URL params
  const urlStep = parseInt(searchParams.get('step') ?? '1', 10);
  const urlBuchungId = searchParams.get('buchungId') ?? null;

  // State — ALL hooks before any early returns
  const [currentStep, setCurrentStep] = useState<number>(
    urlStep >= 1 && urlStep <= 3 ? urlStep : 1
  );
  const [selectedBuchungId, setSelectedBuchungId] = useState<string | null>(urlBuchungId);
  const [catProtokoll, setCatProtokoll] = useState<CatProtokoll | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { buchungsverwaltung, katzenverwaltung, kundenverwaltungMap, loading, error, fetchAll } =
    useDashboardData();

  // Step navigation with URL sync
  const handleStepChange = useCallback(
    (step: number) => {
      setCurrentStep(step);
      const params = new URLSearchParams(searchParams);
      params.set('step', String(step));
      if (selectedBuchungId) params.set('buchungId', selectedBuchungId);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams, selectedBuchungId]
  );

  // ---- Step 1: Select Booking ----

  const activeBuchungen = buchungsverwaltung.filter((b) => {
    const statusKey = b.fields.buchungsstatus?.key;
    return statusKey === 'bestaetigt' || statusKey === 'eingecheckt';
  });

  const displayBuchungen =
    activeBuchungen.length > 0 ? activeBuchungen : buchungsverwaltung;

  const buchungItems = displayBuchungen.map((b) => ({
    id: b.record_id,
    title: `Buchung #${b.fields.buchungsnummer ?? b.record_id.slice(0, 8)}`,
    subtitle: getKundeName(b, kundenverwaltungMap as unknown as Map<string, { fields: { vorname?: string; nachname?: string } }>),
    status: b.fields.buchungsstatus
      ? { key: b.fields.buchungsstatus.key, label: b.fields.buchungsstatus.label }
      : undefined,
    stats: b.fields.anreise
      ? [{ label: 'Anreise', value: formatAnreise(b.fields.anreise) }]
      : undefined,
    icon: <IconPaw size={18} className="text-primary" />,
  }));

  function buildCatProtokoll(buchung: Buchungsverwaltung, cats: Katzenverwaltung[]): CatProtokoll | null {
    const catId = extractRecordId(buchung.fields.katzen);
    if (!catId) return null;
    const cat = cats.find((c) => c.record_id === catId);
    return {
      catId,
      catName: cat?.fields.katze_name ?? catId.slice(0, 8) + '…',
      fressverhalten: '',
      aktivitaet: '',
      befinden: '',
      medikamente_verabreicht: false,
      medikamente_notiz: '',
      beobachtungen: '',
      expanded: true,
    };
  }

  function handleSelectBuchung(id: string) {
    const buchung = buchungsverwaltung.find((b) => b.record_id === id);
    if (!buchung) return;
    setSelectedBuchungId(id);
    const protokoll = buildCatProtokoll(buchung, katzenverwaltung);
    setCatProtokoll(protokoll);
    const params = new URLSearchParams(searchParams);
    params.set('buchungId', id);
    params.set('step', '2');
    setSearchParams(params, { replace: true });
    setCurrentStep(2);
  }

  // ---- Step 2: Fill Protocols ----

  function updateProtokoll(field: keyof CatProtokoll, value: unknown) {
    setCatProtokoll((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  }

  const isProtokollFilled = catProtokoll !== null && catProtokoll.befinden !== '';
  const filledCount = isProtokollFilled ? 1 : 0;
  const totalCount = catProtokoll ? 1 : 0;

  // ---- Step 3: Save ----

  const selectedBuchung = buchungsverwaltung.find((b) => b.record_id === selectedBuchungId) ?? null;

  async function handleSubmit() {
    if (!selectedBuchungId || !catProtokoll) return;
    setSaving(true);
    setSaveError(null);
    setSavedCount(0);

    try {
      await LivingAppsService.createGesundheitsprotokollEntry({
        buchung: createRecordUrl(APP_IDS.BUCHUNGSVERWALTUNG, selectedBuchungId),
        katze: createRecordUrl(APP_IDS.KATZENVERWALTUNG, catProtokoll.catId),
        protokoll_datum: TODAY,
        fressverhalten: catProtokoll.fressverhalten || undefined,
        aktivitaet: catProtokoll.aktivitaet || undefined,
        befinden: catProtokoll.befinden || undefined,
        medikamente_verabreicht: catProtokoll.medikamente_verabreicht,
        medikamente_notiz: catProtokoll.medikamente_verabreicht ? catProtokoll.medikamente_notiz : undefined,
        beobachtungen: catProtokoll.beobachtungen || undefined,
      });
      setSavedCount(1);
      await fetchAll();
      setDone(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSelectedBuchungId(null);
    setCatProtokoll(null);
    setSaving(false);
    setSavedCount(0);
    setSaveError(null);
    setDone(false);
    setCurrentStep(1);
    const params = new URLSearchParams();
    setSearchParams(params, { replace: true });
  }

  // ---- Render ----

  return (
    <IntentWizardShell
      title="Tägliche Pflegerunde"
      subtitle="Wähle eine Buchung und erfasse das Gesundheitsprotokoll für die Katze."
      steps={[
        { label: 'Buchung wählen' },
        { label: 'Protokoll erfassen' },
        { label: 'Abschliessen' },
      ]}
      currentStep={currentStep}
      onStepChange={handleStepChange}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ---- STEP 1 ---- */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <IconClipboardList size={18} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {activeBuchungen.length > 0
                ? `${activeBuchungen.length} aktive Buchung${activeBuchungen.length !== 1 ? 'en' : ''} gefunden`
                : 'Keine aktiven Buchungen – alle Buchungen werden angezeigt'}
            </p>
          </div>
          <EntitySelectStep
            items={buchungItems}
            onSelect={handleSelectBuchung}
            searchPlaceholder="Buchung suchen…"
            emptyIcon={<IconPaw size={32} />}
            emptyText="Keine Buchungen gefunden."
          />
        </div>
      )}

      {/* ---- STEP 2 ---- */}
      {currentStep === 2 && catProtokoll && (
        <div className="space-y-4">
          {/* Booking context */}
          {selectedBuchung && (
            <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/40">
              <IconPaw size={16} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate">
                  Buchung #{selectedBuchung.fields.buchungsnummer ?? selectedBuchungId?.slice(0, 8)}
                </span>
                {selectedBuchung.fields.buchungsstatus && (
                  <StatusBadge
                    statusKey={selectedBuchung.fields.buchungsstatus.key}
                    label={selectedBuchung.fields.buchungsstatus.label}
                    className="ml-2"
                  />
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatAnreise(selectedBuchung.fields.anreise)}
              </span>
            </div>
          )}

          {/* Progress counter */}
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Protokoll erfassen</span>
            <span className="text-muted-foreground">
              <span className={`font-semibold ${filledCount > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                {filledCount}
              </span>{' '}
              von {totalCount} Protokoll ausgefüllt
            </span>
          </div>

          {/* Cat card */}
          <div className="rounded-xl border bg-card overflow-hidden">
            {/* Card header */}
            <button
              onClick={() => updateProtokoll('expanded', !catProtokoll.expanded)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <IconPaw size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm truncate block">{catProtokoll.catName}</span>
                {catProtokoll.befinden && (
                  <span className="text-xs text-muted-foreground">
                    Befinden: {BEFINDEN_OPTIONS.find((o) => o.key === catProtokoll.befinden)?.label ?? catProtokoll.befinden}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isProtokollFilled && (
                  <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <IconCheck size={12} stroke={2.5} className="text-white" />
                  </span>
                )}
                {catProtokoll.expanded ? (
                  <IconChevronUp size={16} className="text-muted-foreground" />
                ) : (
                  <IconChevronDown size={16} className="text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Card body */}
            {catProtokoll.expanded && (
              <div className="px-4 pb-4 space-y-4 border-t">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                  {/* Fressverhalten */}
                  <div className="space-y-1.5">
                    <Label htmlFor="fressverhalten" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Fressverhalten
                    </Label>
                    <select
                      id="fressverhalten"
                      value={catProtokoll.fressverhalten}
                      onChange={(e) => updateProtokoll('fressverhalten', e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">– wählen –</option>
                      {FRESSVERHALTEN_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Aktivität */}
                  <div className="space-y-1.5">
                    <Label htmlFor="aktivitaet" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Aktivität
                    </Label>
                    <select
                      id="aktivitaet"
                      value={catProtokoll.aktivitaet}
                      onChange={(e) => updateProtokoll('aktivitaet', e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">– wählen –</option>
                      {AKTIVITAET_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Befinden */}
                  <div className="space-y-1.5">
                    <Label htmlFor="befinden" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Befinden <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="befinden"
                      value={catProtokoll.befinden}
                      onChange={(e) => updateProtokoll('befinden', e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">– wählen –</option>
                      {BEFINDEN_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Medikamente */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="medikamente_verabreicht"
                      checked={catProtokoll.medikamente_verabreicht}
                      onCheckedChange={(checked) =>
                        updateProtokoll('medikamente_verabreicht', checked === true)
                      }
                    />
                    <Label htmlFor="medikamente_verabreicht" className="text-sm cursor-pointer">
                      Medikamente verabreicht
                    </Label>
                  </div>
                  {catProtokoll.medikamente_verabreicht && (
                    <Input
                      placeholder="Welche Medikamente wurden verabreicht?"
                      value={catProtokoll.medikamente_notiz}
                      onChange={(e) => updateProtokoll('medikamente_notiz', e.target.value)}
                      className="w-full"
                    />
                  )}
                </div>

                {/* Beobachtungen */}
                <div className="space-y-1.5">
                  <Label htmlFor="beobachtungen" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Beobachtungen
                  </Label>
                  <Textarea
                    id="beobachtungen"
                    placeholder="Besondere Beobachtungen, Auffälligkeiten…"
                    value={catProtokoll.beobachtungen}
                    onChange={(e) => updateProtokoll('beobachtungen', e.target.value)}
                    rows={3}
                    className="w-full resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => handleStepChange(1)}
              className="gap-2"
            >
              <IconArrowLeft size={16} />
              Zurück
            </Button>
            <Button
              onClick={() => handleStepChange(3)}
              disabled={totalCount === 0}
              className="gap-2"
            >
              Weiter zur Zusammenfassung
              <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ---- STEP 2 fallback: no cat ---- */}
      {currentStep === 2 && !catProtokoll && (
        <div className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            <IconPaw size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Keine Katze mit dieser Buchung verknüpft.</p>
          </div>
          <Button variant="outline" onClick={() => handleStepChange(1)} className="gap-2">
            <IconArrowLeft size={16} />
            Zurück zur Buchungsauswahl
          </Button>
        </div>
      )}

      {/* ---- STEP 3 ---- */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {done ? (
            /* Success state */
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <IconCheck size={28} stroke={2.5} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Pflegerunde abgeschlossen!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {savedCount} Gesundheitsprotokoll wurde erfolgreich gespeichert.
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Datum: {TODAY}</p>
              </div>
              <Button onClick={handleReset} className="gap-2 mt-2">
                <IconRefresh size={16} />
                Neue Pflegerunde
              </Button>
            </div>
          ) : (
            <>
              {/* Summary card */}
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <h2 className="font-semibold text-base">Zusammenfassung</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Buchung</span>
                    <p className="font-medium">
                      {selectedBuchung
                        ? `#${selectedBuchung.fields.buchungsnummer ?? selectedBuchungId?.slice(0, 8)}`
                        : '–'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Datum</span>
                    <p className="font-medium">{TODAY}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Protokolle bereit</span>
                    <p className="font-medium">
                      <span className={isProtokollFilled ? 'text-green-600' : 'text-amber-600'}>
                        {filledCount}
                      </span>{' '}
                      von {totalCount}
                    </p>
                  </div>
                  {selectedBuchung?.fields.buchungsstatus && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Status</span>
                      <div>
                        <StatusBadge
                          statusKey={selectedBuchung.fields.buchungsstatus.key}
                          label={selectedBuchung.fields.buchungsstatus.label}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Cat protocol preview */}
              {catProtokoll && (
                <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <IconPaw size={16} className="text-primary shrink-0" />
                    <span className="font-medium text-sm">{catProtokoll.catName}</span>
                    {isProtokollFilled ? (
                      <span className="ml-auto text-xs text-green-600 font-medium">Ausgefüllt</span>
                    ) : (
                      <span className="ml-auto text-xs text-amber-600 font-medium">Befinden fehlt</span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                    {catProtokoll.fressverhalten && (
                      <span>
                        Fressen:{' '}
                        <span className="text-foreground font-medium">
                          {FRESSVERHALTEN_OPTIONS.find((o) => o.key === catProtokoll.fressverhalten)?.label ?? catProtokoll.fressverhalten}
                        </span>
                      </span>
                    )}
                    {catProtokoll.aktivitaet && (
                      <span>
                        Aktivität:{' '}
                        <span className="text-foreground font-medium">
                          {AKTIVITAET_OPTIONS.find((o) => o.key === catProtokoll.aktivitaet)?.label ?? catProtokoll.aktivitaet}
                        </span>
                      </span>
                    )}
                    {catProtokoll.befinden && (
                      <span>
                        Befinden:{' '}
                        <span className="text-foreground font-medium">
                          {BEFINDEN_OPTIONS.find((o) => o.key === catProtokoll.befinden)?.label ?? catProtokoll.befinden}
                        </span>
                      </span>
                    )}
                    {catProtokoll.medikamente_verabreicht && (
                      <span className="text-amber-700">Medikamente verabreicht</span>
                    )}
                  </div>
                </div>
              )}

              {/* Save error */}
              {saveError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  Fehler: {saveError}
                </div>
              )}

              {/* Saving progress */}
              {saving && (
                <div className="text-sm text-muted-foreground text-center">
                  Speichere… {savedCount} von {totalCount} gespeichert
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={() => handleStepChange(2)}
                  disabled={saving}
                  className="gap-2"
                >
                  <IconArrowLeft size={16} />
                  Zurück
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={saving || !isProtokollFilled}
                  className="gap-2"
                >
                  {saving ? 'Wird gespeichert…' : 'Pflegerunde abschliessen'}
                  {!saving && <IconCheck size={16} />}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
