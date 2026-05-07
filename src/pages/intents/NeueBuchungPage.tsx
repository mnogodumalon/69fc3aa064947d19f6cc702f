import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { BudgetTracker } from '@/components/BudgetTracker';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Kundenverwaltung, Katzenverwaltung, Zimmerverwaltung, Leistungsverwaltung } from '@/types/app';
import { KundenverwaltungDialog } from '@/components/dialogs/KundenverwaltungDialog';
import { KatzenverwaltungDialog } from '@/components/dialogs/KatzenverwaltungDialog';
import { ZimmerverwaltungDialog } from '@/components/dialogs/ZimmerverwaltungDialog';
import { LeistungsverwaltungDialog } from '@/components/dialogs/LeistungsverwaltungDialog';
import {
  IconUser,
  IconCat,
  IconBuilding,
  IconStar,
  IconCheck,
  IconPlus,
  IconRefresh,
  IconCalendar,
  IconCurrencyEuro,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Kunde' },
  { label: 'Katzen' },
  { label: 'Zimmer' },
  { label: 'Leistungen' },
  { label: 'Bestätigen' },
];

function getInitialStep(searchParams: URLSearchParams): number {
  const s = parseInt(searchParams.get('step') ?? '', 10);
  if (s >= 1 && s <= 5) return s;
  return 1;
}

export default function NeueBuchungPage() {
  const [searchParams] = useSearchParams();

  const { kundenverwaltung, katzenverwaltung, zimmerverwaltung, leistungsverwaltung, loading, error, fetchAll } =
    useDashboardData();

  const [currentStep, setCurrentStep] = useState<number>(() => getInitialStep(searchParams));

  // Selections
  const [selectedKundeId, setSelectedKundeId] = useState<string | null>(null);
  const [selectedKatzenIds, setSelectedKatzenIds] = useState<string[]>([]);
  const [selectedZimmerId, setSelectedZimmerId] = useState<string | null>(null);
  const [selectedLeistungIds, setSelectedLeistungIds] = useState<string[]>([]);

  // Booking fields
  const [anreise, setAnreise] = useState<string>('');
  const [abreise, setAbreise] = useState<string>('');
  const [gesamtpreis, setGesamtpreis] = useState<string>('');
  const [anzahlung, setAnzahlung] = useState<string>('');
  const [buchungshinweise, setBuchungshinweise] = useState<string>('');

  // Dialog open states
  const [kundeDialogOpen, setKundeDialogOpen] = useState(false);
  const [katzeDialogOpen, setKatzeDialogOpen] = useState(false);
  const [zimmerDialogOpen, setZimmerDialogOpen] = useState(false);
  const [leistungDialogOpen, setLeistungDialogOpen] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successBuchungsnummer, setSuccessBuchungsnummer] = useState<string | null>(null);

  // Derived data
  const selectedKunde = useMemo<Kundenverwaltung | undefined>(
    () => kundenverwaltung.find((k) => k.record_id === selectedKundeId),
    [kundenverwaltung, selectedKundeId]
  );

  const katzenForKunde = useMemo<Katzenverwaltung[]>(() => {
    if (!selectedKundeId) return [];
    const kundeUrl = createRecordUrl(APP_IDS.KUNDENVERWALTUNG, selectedKundeId);
    return katzenverwaltung.filter((k) => {
      const besitzerUrl = k.fields.besitzer;
      if (!besitzerUrl) return false;
      try {
        const id = extractRecordId(besitzerUrl);
        return id === selectedKundeId || besitzerUrl === kundeUrl;
      } catch {
        return besitzerUrl === kundeUrl;
      }
    });
  }, [katzenverwaltung, selectedKundeId]);

  const selectedZimmer = useMemo<Zimmerverwaltung | undefined>(
    () => zimmerverwaltung.find((z) => z.record_id === selectedZimmerId),
    [zimmerverwaltung, selectedZimmerId]
  );

  const availableZimmer = useMemo<Zimmerverwaltung[]>(() => {
    const verfuegbar = zimmerverwaltung.filter((z) => z.fields.zimmer_status?.key === 'verfuegbar');
    return verfuegbar.length > 0 ? verfuegbar : zimmerverwaltung;
  }, [zimmerverwaltung]);

  const selectedLeistungen = useMemo<Leistungsverwaltung[]>(
    () => leistungsverwaltung.filter((l) => selectedLeistungIds.includes(l.record_id)),
    [leistungsverwaltung, selectedLeistungIds]
  );

  const leistungenGesamtpreis = useMemo<number>(
    () => selectedLeistungen.reduce((sum, l) => sum + (l.fields.preis ?? 0), 0),
    [selectedLeistungen]
  );

  const calculatedGesamtpreis = useMemo<number>(() => {
    if (!anreise || !abreise || !selectedZimmer) return leistungenGesamtpreis;
    const start = new Date(anreise);
    const end = new Date(abreise);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return days * (selectedZimmer.fields.tagespreis ?? 0) + leistungenGesamtpreis;
  }, [anreise, abreise, selectedZimmer, leistungenGesamtpreis]);

  // Update gesamtpreis when it's calculated
  const handleStepChange = useCallback(
    (step: number) => {
      if (step === 5 && gesamtpreis === '') {
        setGesamtpreis(String(calculatedGesamtpreis));
      }
      setCurrentStep(step);
    },
    [calculatedGesamtpreis, gesamtpreis]
  );

  const toggleKatze = (id: string) => {
    setSelectedKatzenIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleLeistung = (id: string) => {
    setSelectedLeistungIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!selectedKundeId || !selectedZimmerId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const buchungsnummer = `BU-${Date.now()}`;
      await LivingAppsService.createBuchungsverwaltungEntry({
        buchungsnummer,
        buchungsstatus: 'bestaetigt',
        anreise: anreise || undefined,
        abreise: abreise || undefined,
        kunde: createRecordUrl(APP_IDS.KUNDENVERWALTUNG, selectedKundeId),
        katzen:
          selectedKatzenIds.length > 0
            ? createRecordUrl(APP_IDS.KATZENVERWALTUNG, selectedKatzenIds[0])
            : undefined,
        zimmer: createRecordUrl(APP_IDS.ZIMMERVERWALTUNG, selectedZimmerId),
        zusatzleistungen:
          selectedLeistungIds.length > 0
            ? createRecordUrl(APP_IDS.LEISTUNGSVERWALTUNG, selectedLeistungIds[0])
            : undefined,
        gesamtpreis: gesamtpreis ? parseFloat(gesamtpreis) : undefined,
        anzahlung: anzahlung ? parseFloat(anzahlung) : undefined,
        zahlungsstatus: 'ausstehend',
        buchungshinweise: buchungshinweise || undefined,
      });
      setSuccessBuchungsnummer(buchungsnummer);
      void fetchAll();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Buchung konnte nicht gespeichert werden.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setSelectedKundeId(null);
    setSelectedKatzenIds([]);
    setSelectedZimmerId(null);
    setSelectedLeistungIds([]);
    setAnreise('');
    setAbreise('');
    setGesamtpreis('');
    setAnzahlung('');
    setBuchungshinweise('');
    setSuccessBuchungsnummer(null);
    setSubmitError(null);
  };

  // ─── Success screen ───────────────────────────────────────────────────────
  if (successBuchungsnummer) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <IconCheck size={32} className="text-green-600" stroke={2.5} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
              Buchung erfolgreich erstellt!
            </h2>
            <p className="text-muted-foreground text-sm">
              Buchungsnummer:{' '}
              <span className="font-mono font-semibold text-foreground">{successBuchungsnummer}</span>
            </p>
          </div>
          <Button onClick={handleReset} className="gap-2">
            <IconRefresh size={16} stroke={2} />
            Neue Buchung
          </Button>
        </div>
      </div>
    );
  }

  // ─── Wizard ───────────────────────────────────────────────────────────────
  return (
    <IntentWizardShell
      title="Neue Buchung"
      subtitle="Führe dich durch alle Schritte, um eine neue Katzenpension-Buchung anzulegen."
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={handleStepChange}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Kunde wählen ─────────────────────────────────────────── */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Kunde wählen</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Wähle den Kunden aus, für den du die Buchung anlegst.
            </p>
          </div>
          <EntitySelectStep
            items={kundenverwaltung.map((k) => ({
              id: k.record_id,
              title: [k.fields.vorname, k.fields.nachname].filter(Boolean).join(' ') || '(Unbekannt)',
              subtitle: k.fields.email,
              stats: k.fields.telefon
                ? [{ label: 'Telefon', value: k.fields.telefon }]
                : undefined,
              icon: <IconUser size={18} className="text-primary" stroke={1.5} />,
            }))}
            onSelect={(id) => {
              setSelectedKundeId(id);
              setSelectedKatzenIds([]);
              setCurrentStep(2);
            }}
            searchPlaceholder="Kunde suchen..."
            emptyText="Kein Kunde gefunden. Lege einen neuen an."
            emptyIcon={<IconUser size={32} />}
            createLabel="Neuen Kunden anlegen"
            onCreateNew={() => setKundeDialogOpen(true)}
            createDialog={
              <KundenverwaltungDialog
                open={kundeDialogOpen}
                onClose={() => setKundeDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createKundenverwaltungEntry(fields);
                  await fetchAll();
                }}
                defaultValues={undefined}
              />
            }
          />
        </div>
      )}

      {/* ── Step 2: Katzen wählen ────────────────────────────────────────── */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Katzen wählen</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Wähle eine oder mehrere Katzen von{' '}
              <span className="font-medium text-foreground">
                {[selectedKunde?.fields.vorname, selectedKunde?.fields.nachname]
                  .filter(Boolean)
                  .join(' ') || 'dem Kunden'}
              </span>{' '}
              aus.
            </p>
          </div>

          {selectedKatzenIds.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium">
              <IconCheck size={15} stroke={2.5} />
              {selectedKatzenIds.length} Katze{selectedKatzenIds.length !== 1 ? 'n' : ''} ausgewählt
            </div>
          )}

          {/* Katzen-Liste als Checkboxen */}
          <div className="space-y-2">
            {katzenForKunde.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <div className="mb-3 flex justify-center opacity-40">
                  <IconCat size={32} />
                </div>
                <p className="text-sm">Keine Katzen für diesen Kunden gefunden.</p>
              </div>
            )}
            {katzenForKunde.map((k) => {
              const isSelected = selectedKatzenIds.includes(k.record_id);
              return (
                <button
                  key={k.record_id}
                  onClick={() => toggleKatze(k.record_id)}
                  className={`w-full text-left flex items-center gap-3 p-4 rounded-xl border transition-colors overflow-hidden ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'bg-card hover:bg-accent hover:border-primary/30'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${
                      isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                    }`}
                  >
                    {isSelected && <IconCheck size={12} className="text-primary-foreground" stroke={3} />}
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <IconCat size={18} className="text-primary" stroke={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm truncate block">
                      {k.fields.katze_name || '(Unbekannt)'}
                    </span>
                    {k.fields.rasse && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{k.fields.rasse}</p>
                    )}
                    {k.fields.geschlecht && (
                      <p className="text-xs text-muted-foreground mt-0.5">{k.fields.geschlecht.label}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setKatzeDialogOpen(true)}
          >
            <IconPlus size={15} stroke={2} />
            Neue Katze anlegen
          </Button>
          <KatzenverwaltungDialog
            open={katzeDialogOpen}
            onClose={() => setKatzeDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createKatzenverwaltungEntry(fields);
              await fetchAll();
            }}
            defaultValues={
              selectedKundeId
                ? { besitzer: createRecordUrl(APP_IDS.KUNDENVERWALTUNG, selectedKundeId) }
                : undefined
            }
            kundenverwaltungList={kundenverwaltung}
          />

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCurrentStep(1)}>
              Zurück
            </Button>
            <Button
              className="flex-1"
              disabled={selectedKatzenIds.length === 0}
              onClick={() => setCurrentStep(3)}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Zimmer wählen ────────────────────────────────────────── */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Zimmer wählen</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Wähle ein verfügbares Zimmer für den Aufenthalt.
            </p>
          </div>
          <EntitySelectStep
            items={availableZimmer.map((z) => ({
              id: z.record_id,
              title: z.fields.zimmer_name || '(Unbekannt)',
              subtitle: z.fields.zimmer_typ?.label,
              status: z.fields.zimmer_status
                ? { key: z.fields.zimmer_status.key, label: z.fields.zimmer_status.label }
                : undefined,
              stats: z.fields.tagespreis != null
                ? [{ label: 'Preis', value: `${z.fields.tagespreis} €/Tag` }]
                : undefined,
              icon: <IconBuilding size={18} className="text-primary" stroke={1.5} />,
            }))}
            onSelect={(id) => {
              setSelectedZimmerId(id);
              setCurrentStep(4);
            }}
            searchPlaceholder="Zimmer suchen..."
            emptyText="Kein Zimmer gefunden."
            emptyIcon={<IconBuilding size={32} />}
            createLabel="Neues Zimmer anlegen"
            onCreateNew={() => setZimmerDialogOpen(true)}
            createDialog={
              <ZimmerverwaltungDialog
                open={zimmerDialogOpen}
                onClose={() => setZimmerDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createZimmerverwaltungEntry(fields);
                  await fetchAll();
                }}
                defaultValues={undefined}
              />
            }
          />
          {/* StatusBadge shown per room is embedded in EntitySelectStep via status prop above */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCurrentStep(2)}>
              Zurück
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Zusatzleistungen ─────────────────────────────────────── */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Zusatzleistungen</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Wähle optional weitere Leistungen für den Aufenthalt aus.
            </p>
          </div>

          {leistungenGesamtpreis > 0 && (
            <BudgetTracker
              budget={leistungenGesamtpreis * 2}
              booked={leistungenGesamtpreis}
              label="Ausgewählte Leistungen"
              showRemaining={false}
            />
          )}

          <div className="space-y-2">
            {leistungsverwaltung.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <div className="mb-3 flex justify-center opacity-40">
                  <IconStar size={32} />
                </div>
                <p className="text-sm">Keine Leistungen verfügbar.</p>
              </div>
            )}
            {leistungsverwaltung.map((l) => {
              const isSelected = selectedLeistungIds.includes(l.record_id);
              return (
                <button
                  key={l.record_id}
                  onClick={() => toggleLeistung(l.record_id)}
                  className={`w-full text-left flex items-center gap-3 p-4 rounded-xl border transition-colors overflow-hidden ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'bg-card hover:bg-accent hover:border-primary/30'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${
                      isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                    }`}
                  >
                    {isSelected && <IconCheck size={12} className="text-primary-foreground" stroke={3} />}
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <IconStar size={18} className="text-primary" stroke={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {l.fields.leistung_name || '(Unbekannt)'}
                      </span>
                      {l.fields.leistung_kategorie && (
                        <StatusBadge
                          statusKey={l.fields.leistung_kategorie.key}
                          label={l.fields.leistung_kategorie.label}
                        />
                      )}
                    </div>
                    {l.fields.leistung_beschreibung && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {l.fields.leistung_beschreibung}
                      </p>
                    )}
                    {l.fields.preis != null && (
                      <p className="text-xs font-semibold text-foreground mt-1">
                        {l.fields.preis} €
                        {l.fields.preiseinheit && (
                          <span className="font-normal text-muted-foreground ml-1">
                            {l.fields.preiseinheit.label}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setLeistungDialogOpen(true)}
          >
            <IconPlus size={15} stroke={2} />
            Neue Leistung anlegen
          </Button>
          <LeistungsverwaltungDialog
            open={leistungDialogOpen}
            onClose={() => setLeistungDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createLeistungsverwaltungEntry(fields);
              await fetchAll();
            }}
            defaultValues={undefined}
          />

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCurrentStep(3)}>
              Zurück
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                if (gesamtpreis === '') setGesamtpreis(String(calculatedGesamtpreis));
                setCurrentStep(5);
              }}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 5: Buchung bestätigen ───────────────────────────────────── */}
      {currentStep === 5 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Buchung bestätigen</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Überprüfe alle Angaben und lege die Buchung an.
            </p>
          </div>

          {/* Summary */}
          <div className="rounded-xl border bg-card divide-y overflow-hidden">
            {/* Kunde */}
            <div className="p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconUser size={18} className="text-primary" stroke={1.5} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Kunde</p>
                <p className="font-medium text-sm truncate">
                  {[selectedKunde?.fields.vorname, selectedKunde?.fields.nachname]
                    .filter(Boolean)
                    .join(' ') || '—'}
                </p>
                {selectedKunde?.fields.email && (
                  <p className="text-xs text-muted-foreground truncate">{selectedKunde.fields.email}</p>
                )}
              </div>
            </div>

            {/* Katzen */}
            <div className="p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconCat size={18} className="text-primary" stroke={1.5} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {selectedKatzenIds.length} Katze{selectedKatzenIds.length !== 1 ? 'n' : ''}
                </p>
                <p className="font-medium text-sm">
                  {katzenverwaltung
                    .filter((k) => selectedKatzenIds.includes(k.record_id))
                    .map((k) => k.fields.katze_name || '(Unbekannt)')
                    .join(', ') || '—'}
                </p>
              </div>
            </div>

            {/* Zimmer */}
            <div className="p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconBuilding size={18} className="text-primary" stroke={1.5} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Zimmer</p>
                <p className="font-medium text-sm truncate">
                  {selectedZimmer?.fields.zimmer_name || '—'}
                </p>
                {selectedZimmer?.fields.tagespreis != null && (
                  <p className="text-xs text-muted-foreground">
                    {selectedZimmer.fields.tagespreis} €/Tag
                  </p>
                )}
              </div>
            </div>

            {/* Leistungen */}
            {selectedLeistungen.length > 0 && (
              <div className="p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconStar size={18} className="text-primary" stroke={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Zusatzleistungen</p>
                  <div className="space-y-0.5 mt-1">
                    {selectedLeistungen.map((l) => (
                      <div key={l.record_id} className="flex items-center justify-between gap-2">
                        <span className="text-sm truncate">{l.fields.leistung_name || '(Unbekannt)'}</span>
                        {l.fields.preis != null && (
                          <span className="text-xs font-medium text-foreground shrink-0">
                            {l.fields.preis} €
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Date & fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <IconCalendar size={14} className="text-muted-foreground" stroke={1.5} />
                Anreise
              </label>
              <input
                type="datetime-local"
                value={anreise}
                onChange={(e) => setAnreise(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <IconCalendar size={14} className="text-muted-foreground" stroke={1.5} />
                Abreise
              </label>
              <input
                type="datetime-local"
                value={abreise}
                onChange={(e) => setAbreise(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <IconCurrencyEuro size={14} className="text-muted-foreground" stroke={1.5} />
                Gesamtpreis (€)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={gesamtpreis}
                onChange={(e) => setGesamtpreis(e.target.value)}
                placeholder={String(calculatedGesamtpreis)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <IconCurrencyEuro size={14} className="text-muted-foreground" stroke={1.5} />
                Anzahlung (€)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={anzahlung}
                onChange={(e) => setAnzahlung(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Buchungshinweise</label>
            <textarea
              value={buchungshinweise}
              onChange={(e) => setBuchungshinweise(e.target.value)}
              rows={3}
              placeholder="Besondere Wünsche oder Hinweise..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
            />
          </div>

          {submitError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCurrentStep(4)} disabled={submitting}>
              Zurück
            </Button>
            <Button
              className="flex-1"
              disabled={!selectedKundeId || !selectedZimmerId || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Wird gespeichert...' : 'Buchung anlegen'}
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
