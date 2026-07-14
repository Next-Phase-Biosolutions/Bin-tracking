import React, { useState, useCallback, useEffect } from 'react';
import type { NativeScript } from '@meshsdk/core';
import { X, Wallet, CheckCircle2, AlertTriangle, ExternalLink, Loader2, ChevronRight, Copy, Calendar } from 'lucide-react';
import { trpc } from '../../lib/trpc';

type RangePreset = 'today' | '2d' | '7d' | 'custom';

function toInputDate(d: Date) { return d.toISOString().slice(0, 10); }

function todayStr() { return toInputDate(new Date()); }
function daysAgoStr(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return toInputDate(d); }

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 'WALLET_CONNECT' | 'FETCHING' | 'REVIEW' | 'SIGNING' | 'SUCCESS' | 'ERROR';

interface InstalledWallet {
    id: string;    // The window.cardano key (e.g. 'lace') — used for BrowserWallet.enable()
    name: string;  // Display name (e.g. 'Lace')
    icon: string;
    version: string;
}

interface Props {
    onClose: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CARDANO_NETWORK = (import.meta.env.VITE_CARDANO_NETWORK as string | undefined) ?? 'preview';
const BLOCKFROST_KEY = (import.meta.env.VITE_BLOCKFROST_API_KEY as string | undefined) ?? '';
const CARDANO_SCAN_BASE =
    (import.meta.env.VITE_CARDANO_SCAN_BASE_URL as string | undefined) ??
    'https://preview.cardanoscan.io/transaction';

// Cardano network ID: testnet = 0, mainnet = 1
const EXPECTED_NETWORK_ID = CARDANO_NETWORK === 'mainnet' ? 1 : 0;

// ─── Utilities ───────────────────────────────────────────────────────────────

function isValidBech32Address(addr: string): boolean {
    if (CARDANO_NETWORK === 'mainnet') return addr.startsWith('addr1');
    return addr.startsWith('addr_test1');
}

function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => { });
}

// ─── Step indicator ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
    const steps: { key: Step; label: string }[] = [
        { key: 'WALLET_CONNECT', label: 'Connect' },
        { key: 'REVIEW', label: 'Review' },
        { key: 'SIGNING', label: 'Sign' },
        { key: 'SUCCESS', label: 'Done' },
    ];
    const order = steps.map((s) => s.key);
    const currentIdx = order.indexOf(
        current === 'FETCHING'
            ? 'REVIEW'
            : current === 'ERROR'
                ? 'SIGNING'
                : current,
    );

    return (
        <div className="flex items-center gap-1 px-6 pb-4">
            {steps.map((s, i) => (
                <React.Fragment key={s.key}>
                    <div
                        className={`flex items-center gap-1.5 text-xs font-semibold ${i <= currentIdx ? 'text-purple-600' : 'text-gray-400'}`}
                    >
                        <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                            ${i < currentIdx
                                    ? 'bg-purple-600 border-purple-600 text-white'
                                    : i === currentIdx
                                        ? 'border-purple-600 text-purple-600 bg-purple-50'
                                        : 'border-gray-300 text-gray-400'
                                }`}
                        >
                            {i < currentIdx ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                        </div>
                        <span className="hidden sm:inline">{s.label}</span>
                    </div>
                    {i < steps.length - 1 && (
                        <div
                            className={`flex-1 h-0.5 mx-1 rounded ${i < currentIdx ? 'bg-purple-600' : 'bg-gray-200'}`}
                        />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

export function BlockchainAnchorModal({ onClose }: Props) {
    const [step, setStep] = useState<Step>('WALLET_CONNECT');
    const [error, setError] = useState<string | null>(null);
    const [walletName, setWalletName] = useState<string | null>(null);
    const [wallet, setWallet] = useState<unknown>(null);
    const [receiverAddress, setReceiverAddress] = useState('');
    const [addressError, setAddressError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [isSigning, setIsSigning] = useState(false);
    const [copied, setCopied] = useState(false);

    // Date range state
    const [rangePreset, setRangePreset] = useState<RangePreset>('today');
    const [fromDate, setFromDate] = useState(todayStr());
    const [toDate, setToDate] = useState(todayStr());
    const [calOpen, setCalOpen] = useState(false);

    function applyPreset(p: RangePreset) {
        setRangePreset(p);
        setCalOpen(false);
        if (p === 'today') { setFromDate(todayStr()); setToDate(todayStr()); }
        else if (p === '2d') { setFromDate(daysAgoStr(2)); setToDate(todayStr()); }
        else if (p === '7d') { setFromDate(daysAgoStr(7)); setToDate(todayStr()); }
        else { setCalOpen(true); }
    }

    const rangeLabel = fromDate === toDate ? fromDate : `${fromDate} → ${toDate}`;

    // Fetch summary — enabled as soon as wallet is connected
    const summaryQuery = trpc.blockchain.getDailySummary.useQuery(
        { fromDate, toDate },
        {
            enabled: step === 'FETCHING' || step === 'REVIEW' || step === 'SIGNING',
            retry: 2,
        },
    );

    const { data: summary, isLoading: isFetching, error: fetchError } = summaryQuery;

    // Transition from FETCHING → REVIEW when data arrives
    useEffect(() => {
        if (step === 'FETCHING' && summary && !isFetching) {
            setStep('REVIEW');
        }
        if (fetchError && step === 'FETCHING') {
            setError(fetchError.message);
            setStep('ERROR');
        }
    }, [summary, isFetching, fetchError, step]);

    const confirmAnchorMutation = trpc.blockchain.confirmAnchor.useMutation();

    // ── Step 1: Connect wallet ──────────────────────────────────────────────
    const handleConnectWallet = useCallback(async (name: string) => {
        setError(null);
        try {
            // Dynamic import — required because BrowserWallet accesses window.cardano at import time
            const { BrowserWallet } = await import('@meshsdk/wallet');
            const w = await BrowserWallet.enable(name);

            // Network guard: prevent accidental mainnet/testnet mismatch
            const networkId = await w.getNetworkId();
            if (networkId !== EXPECTED_NETWORK_ID) {
                const expected = EXPECTED_NETWORK_ID === 1 ? 'Mainnet' : 'Testnet (Preview/Preprod)';
                const got = networkId === 1 ? 'Mainnet' : 'Testnet';
                throw new Error(
                    `Wrong network in wallet. Expected ${expected} but wallet is on ${got}. Switch networks in ${name} and try again.`,
                );
            }

            setWallet(w);
            setWalletName(name);
            setStep('FETCHING');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to connect wallet');
        }
    }, []);

    // ── Step 3: Validate receiver address live ──────────────────────────────
    const handleAddressChange = useCallback((value: string) => {
        setReceiverAddress(value);
        if (value && !isValidBech32Address(value)) {
            const prefix = CARDANO_NETWORK === 'mainnet' ? 'addr1' : 'addr_test1';
            setAddressError(`Address must start with "${prefix}" for ${CARDANO_NETWORK} network`);
        } else {
            setAddressError(null);
        }
    }, []);

    // ── Step 4: Build + sign + submit transaction ───────────────────────────
    const handleSignAndSubmit = useCallback(async () => {
        if (!wallet || !summary || !summary.cip25Payload || summary.cycleIds.length === 0) return;

        setIsSigning(true);
        setError(null);

        try {
            // All imports are dynamic — none of these work at module load time in a browser
            const { BrowserWallet } = await import('@meshsdk/wallet');
            const {
                MeshTxBuilder,
                BlockfrostProvider,
                resolveNativeScriptHash,
                resolvePaymentKeyHash,
                serializeNativeScript,
            } = await import('@meshsdk/core');

            if (!BLOCKFROST_KEY) throw new Error('VITE_BLOCKFROST_API_KEY is not set');

            // BrowserWallet has a private constructor so we use unknown → any cast
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const bw = wallet as any;
            const provider = new BlockfrostProvider(BLOCKFROST_KEY);

            // Get the wallet's payment key hash (used to restrict minting to this wallet)
            const usedAddresses = await bw.getUsedAddresses();
            const walletBech32 = usedAddresses[0] ?? (await bw.getChangeAddress());
            const paymentKeyHash = resolvePaymentKeyHash(walletBech32);

            // Build time-locked native script
            // Script locks ~30 minutes from now — after that, nobody can mint under this policy
            // Get current slot by calling Blockfrost REST API directly
            // (BlockfrostProvider.fetchCurrentSlot does not exist in this version)
            const blockfrostBaseUrl =
                CARDANO_NETWORK === 'mainnet'
                    ? 'https://cardano-mainnet.blockfrost.io/api/v0'
                    : CARDANO_NETWORK === 'preprod'
                        ? 'https://cardano-preprod.blockfrost.io/api/v0'
                        : 'https://cardano-preview.blockfrost.io/api/v0';

            const latestBlock = await fetch(`${blockfrostBaseUrl}/blocks/latest`, {
                headers: { project_id: BLOCKFROST_KEY },
            }).then((r) => r.json() as Promise<{ slot: number }>);

            const slot = latestBlock.slot;
            const lockSlot = slot + 1800; // ~30 min of Cardano slots (1 slot ≈ 1 second)

            const nativeScript: NativeScript = {
                type: 'all',
                scripts: [
                    { type: 'sig', keyHash: paymentKeyHash },
                    { type: 'before', slot: lockSlot.toString() },
                ],
            };

            const policyId = resolveNativeScriptHash(nativeScript);
            const { scriptCbor } = serializeNativeScript(nativeScript, undefined, EXPECTED_NETWORK_ID);

            const assetName = summary.cip25Payload['__assetName'] as string;

            // assetName must be hex-encoded for the transaction builder
            const assetNameHex = Buffer.from(assetName, 'utf8').toString('hex');
            const unit = `${policyId}${assetNameHex}`;

            // Build the CIP-25 metadata with the real policy ID injected
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { __assetName: _unused, ...payloadFields } = summary.cip25Payload;
            const cip25Metadata = {
                [policyId]: { [assetName]: payloadFields },
                version: 1,
            };

            // Fetch wallet UTxOs for fee calculation
            const utxos = await bw.getUtxos();
            const changeAddress = await bw.getChangeAddress();

            const txBuilder = new MeshTxBuilder({
                fetcher: provider,
                submitter: provider,
            });

            // Construct the minting transaction
            const unsignedTx = await txBuilder
                .mint('1', policyId, assetNameHex)
                .mintingScript(scriptCbor ?? '')
                .txOut(receiverAddress, [{ unit, quantity: '1' }])
                .metadataValue(721, cip25Metadata)
                .invalidHereafter(lockSlot)
                .changeAddress(changeAddress)
                .selectUtxosFrom(utxos)
                .complete();

            // Open the wallet popup — user approves/rejects here
            const signedTx = await bw.signTx(unsignedTx, false);

            // Submit to Cardano network via the wallet
            const submittedHash = await bw.submitTx(signedTx);

            // Mark anchored in DB (idempotent — safe to retry)
            await confirmAnchorMutation.mutateAsync({
                cycleIds: summary.cycleIds,
                txHash: submittedHash,
            });

            setTxHash(submittedHash);
            setStep('SUCCESS');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Transaction failed';
            // User rejection is not a hard error — let them retry
            if (
                message.toLowerCase().includes('user declined') ||
                message.toLowerCase().includes('user rejected') ||
                message.toLowerCase().includes('cancelled')
            ) {
                setError('You declined the transaction in your wallet. Click "Sign Transaction" to try again.');
                // Stay on SIGNING step so they can retry without going back
            } else {
                setError(message);
                setStep('ERROR');
            }
        } finally {
            setIsSigning(false);
        }
    }, [wallet, summary, receiverAddress, confirmAnchorMutation]);

    const handleCopy = useCallback(() => {
        if (!txHash) return;
        copyToClipboard(txHash);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [txHash]);

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
            <div
                className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-700 to-indigo-700 text-white p-5 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                            Cardano Blockchain
                        </p>
                        <h2 className="text-xl font-bold">Post on Blockchain</h2>
                        <p className="text-xs text-white/70 mt-0.5">
                            {CARDANO_NETWORK} · {rangeLabel}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/60 hover:text-white p-1 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="pt-5">
                    <StepIndicator current={step} />
                </div>

                <div className="px-6 pb-6 space-y-5">
                    {/* ── STEP 1: Wallet Connect ── */}
                    {step === 'WALLET_CONNECT' && (
                        <WalletConnectStep onConnect={handleConnectWallet} error={error} />
                    )}

                    {/* ── FETCHING spinner ── */}
                    {(step === 'FETCHING' || (step === 'REVIEW' && isFetching)) && (
                        <div className="flex flex-col items-center gap-3 py-10 text-gray-500">
                            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                            <p className="text-sm font-medium">Loading today's operations data…</p>
                        </div>
                    )}

                    {/* ── STEP 2+3: Review + Receiver ── */}

                    {/* Date range selector — shown in REVIEW/FETCHING */}
                    {(step === 'REVIEW' || step === 'FETCHING') && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Range</p>
                            <div className="flex flex-wrap items-center gap-2">
                                {/* Preset pills */}
                                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                                    {([
                                        { key: 'today', label: 'Today' },
                                        { key: '2d', label: '2 Days' },
                                        { key: '7d', label: '7 Days' },
                                        { key: 'custom', label: 'Custom', icon: true },
                                    ] as { key: RangePreset; label: string; icon?: boolean }[]).map((p) => (
                                        <button
                                            key={p.key}
                                            onClick={() => applyPreset(p.key)}
                                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 ${rangePreset === p.key ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                                        >
                                            {p.icon && <Calendar className="w-3 h-3" />}
                                            {p.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Custom calendar trigger */}
                                {rangePreset === 'custom' && (
                                    <button
                                        onClick={() => setCalOpen(o => !o)}
                                        className="flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg px-3 py-1.5 hover:bg-gray-100 transition-colors"
                                    >
                                        <Calendar className="w-3.5 h-3.5 text-purple-600" />
                                        {fromDate} → {toDate}
                                    </button>
                                )}
                            </div>

                            {/* Custom date popover */}
                            {rangePreset === 'custom' && calOpen && (
                                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Custom Range</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-gray-500 font-medium mb-1 block">From</label>
                                            <input
                                                type="date"
                                                value={fromDate}
                                                max={toDate}
                                                onChange={(e) => setFromDate(e.target.value)}
                                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-purple-300 outline-none bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 font-medium mb-1 block">To</label>
                                            <input
                                                type="date"
                                                value={toDate}
                                                min={fromDate}
                                                max={toInputDate(new Date())}
                                                onChange={(e) => setToDate(e.target.value)}
                                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-purple-300 outline-none bg-white"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setCalOpen(false)}
                                        className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-1.5 rounded-lg transition-colors"
                                    >
                                        Apply
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'REVIEW' && !isFetching && summary && summary.totalCycles === 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-amber-800 text-sm">No completed cycles</p>
                                <p className="text-xs text-amber-600 mt-1">
                                    No completed bin cycles found for <strong>{rangeLabel}</strong>. Try a different date range.
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 'REVIEW' && !isFetching && summary && summary.totalCycles > 0 && (
                        <ReviewStep
                            summary={summary}
                            walletName={walletName!}
                            rangeLabel={rangeLabel}
                            receiverAddress={receiverAddress}
                            addressError={addressError}
                            onAddressChange={handleAddressChange}
                            onNext={() => setStep('SIGNING')}
                        />
                    )}

                    {/* ── STEP 4: Sign ── */}
                    {step === 'SIGNING' && summary && (
                        <SignStep
                            summary={summary}
                            receiverAddress={receiverAddress}
                            isSigning={isSigning}
                            error={error}
                            onSign={handleSignAndSubmit}
                            onBack={() => setStep('REVIEW')}
                        />
                    )}

                    {/* ── STEP 5: Success ── */}
                    {step === 'SUCCESS' && txHash && (
                        <SuccessStep
                            txHash={txHash}
                            rangeLabel={rangeLabel}
                            cardanoScanBase={CARDANO_SCAN_BASE}
                            copied={copied}
                            onCopy={handleCopy}
                            onClose={onClose}
                        />
                    )}

                    {/* ── ERROR ── */}
                    {step === 'ERROR' && (
                        <div className="space-y-4">
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-red-800 text-sm">Something went wrong</p>
                                    <p className="text-xs text-red-600 mt-1 break-words">{error}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setError(null);
                                    setStep('WALLET_CONNECT');
                                    setWallet(null);
                                    setWalletName(null);
                                }}
                                className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-colors"
                            >
                                Start Over
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WalletConnectStep({
    onConnect,
    error,
}: {
    onConnect: (name: string) => void;
    error: string | null;
}) {
    const [installedWallets, setInstalledWallets] = useState<InstalledWallet[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function detectWallets() {
            const { BrowserWallet } = await import('@meshsdk/wallet');

            const tryDetect = async () => {
                if (cancelled) return;
                const wallets = BrowserWallet.getInstalledWallets();

                if (!cancelled) {
                    setInstalledWallets(wallets);
                    // Stop loading state as soon as we've checked at least once
                    setLoading(false);
                }

                // Keep polling every 1.5s in the background to catch late-injecting extensions
                setTimeout(tryDetect, 1500);
            };
            await tryDetect();
        }

        detectWallets().catch(() => {
            if (!cancelled) setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    const handleManualRefresh = useCallback(async () => {
        setLoading(true);
        try {
            const { BrowserWallet } = await import('@meshsdk/wallet');
            setInstalledWallets(BrowserWallet.getInstalledWallets());
        } finally {
            setLoading(false);
        }
    }, []);

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-600">
                Connect your Cardano wallet to sign and post today's operations as an immutable NFT on the{' '}
                <span className="font-semibold capitalize">{CARDANO_NETWORK}</span> network.
            </p>
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 break-words">{error}</p>
                </div>
            )}
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                </div>
            ) : installedWallets.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-3">
                    <Wallet className="w-8 h-8 text-amber-500 mx-auto" />
                    <p className="text-sm font-semibold text-amber-800">No Cardano wallet detected</p>
                    <p className="text-xs text-amber-600">
                        Install a CIP-30 wallet extension (Eternl, Nami, or Lace) then refresh the page.
                    </p>
                    <div className="flex items-center gap-4 justify-center mt-2">
                        <a
                            href="https://lace.io"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-purple-600 font-medium hover:underline"
                        >
                            Get Lace <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                            onClick={handleManualRefresh}
                            className="inline-flex items-center gap-1 text-xs text-gray-600 font-medium hover:text-gray-900 transition-colors"
                        >
                            Refresh list
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Detected wallets</p>
                    {installedWallets.map((w) => (
                        <button
                            key={w.id}
                            onClick={() => onConnect(w.id)}
                            className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-300 rounded-xl transition-all group"
                        >
                            {w.icon && (
                                <img src={w.icon} alt={w.name} className="w-8 h-8 rounded-lg flex-shrink-0" />
                            )}
                            <div className="flex-1 text-left">
                                <p className="font-semibold text-gray-900">{w.name}</p>
                                <p className="text-xs text-gray-400">v{w.version}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

type SummaryData = {
    totalCycles: number;
    stats: { total_cycles: number; on_time: number; late: number; compliance_rate: string } | null;
    merkleRoot: string | null;
    alreadyAnchored: boolean;
};

function ReviewStep({
    summary,
    walletName,
    rangeLabel,
    receiverAddress,
    addressError,
    onAddressChange,
    onNext,
}: {
    summary: SummaryData;
    walletName: string;
    rangeLabel: string;
    receiverAddress: string;
    addressError: string | null;
    onAddressChange: (v: string) => void;
    onNext: () => void;
}) {
    const canProceed =
        receiverAddress.length > 0 && !addressError && !summary.alreadyAnchored && summary.totalCycles > 0;

    const addrPrefix = CARDANO_NETWORK === 'mainnet' ? 'addr1…' : 'addr_test1…';

    return (
        <div className="space-y-4">
            {/* Connected indicator */}
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <p className="text-xs font-medium text-green-700 capitalize">Connected: {walletName}</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
                {[
                    { label: 'Cycles', value: summary.stats?.total_cycles ?? 0 },
                    { label: 'On Time', value: summary.stats?.on_time ?? 0 },
                    { label: 'Late', value: summary.stats?.late ?? 0 },
                    { label: 'Compliance', value: `${summary.stats?.compliance_rate ?? '—'}%` },
                ].map((s) => (
                    <div key={s.label} className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Merkle root */}
            {summary.merkleRoot && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        Merkle Root (on-chain proof)
                    </p>
                    <p className="text-xs font-mono text-gray-700 break-all">{summary.merkleRoot}</p>
                </div>
            )}

            {/* Receiver address */}
            <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Receiver Wallet Address</label>
                <p className="text-xs text-gray-500">The NFT will be sent to this address.</p>
                <input
                    type="text"
                    value={receiverAddress}
                    onChange={(e) => onAddressChange(e.target.value)}
                    placeholder={addrPrefix}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm font-mono transition-colors focus:outline-none focus:ring-2
                        ${addressError
                            ? 'border-red-300 focus:ring-red-200'
                            : 'border-gray-200 focus:ring-purple-200 focus:border-purple-400'
                        }`}
                />
                {addressError && <p className="text-xs text-red-500">{addressError}</p>}
            </div>

            <button
                onClick={onNext}
                disabled={!canProceed}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
                Continue to Sign <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

function SignStep({
    summary,
    receiverAddress,
    isSigning,
    error,
    onSign,
    onBack,
}: {
    summary: { totalCycles: number; merkleRoot: string | null };
    receiverAddress: string;
    isSigning: boolean;
    error: string | null;
    onSign: () => void;
    onBack: () => void;
}) {
    return (
        <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">
                    Transaction Summary
                </p>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Action</span>
                        <span className="font-semibold text-gray-900">Mint 1 NFT</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Cycles anchored</span>
                        <span className="font-semibold text-gray-900">{summary.totalCycles}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Network</span>
                        <span className="font-semibold text-gray-900 capitalize">{CARDANO_NETWORK}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-500">NFT sent to</span>
                        <span className="font-mono text-xs text-gray-800 break-all">{receiverAddress}</span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">{error}</p>
                </div>
            )}

            <p className="text-xs text-gray-500 text-center">
                Your wallet extension will open a popup to confirm the transaction. Est. fee: ~0.2 ADA.
            </p>

            <button
                onClick={onSign}
                disabled={isSigning}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
                {isSigning ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Waiting for wallet…
                    </>
                ) : (
                    <>
                        <Wallet className="w-4 h-4" /> Sign Transaction
                    </>
                )}
            </button>
            <button
                onClick={onBack}
                disabled={isSigning}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
                ← Back
            </button>
        </div>
    );
}

function SuccessStep({
    txHash,
    rangeLabel,
    cardanoScanBase,
    copied,
    onCopy,
    onClose,
}: {
    txHash: string;
    rangeLabel: string;
    cardanoScanBase: string;
    copied: boolean;
    onCopy: () => void;
    onClose: () => void;
}) {
    return (
        <div className="space-y-4 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
                <h3 className="text-lg font-bold text-gray-900">Anchored on Cardano!</h3>
                <p className="text-sm text-gray-500 mt-1">
                    Operations for <strong>{rangeLabel}</strong> have been permanently recorded on-chain.
                </p>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-left space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction Hash</p>
                <div className="flex items-center gap-2">
                    <p className="text-xs font-mono text-gray-800 break-all flex-1">{txHash}</p>
                    <button
                        onClick={onCopy}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors"
                        title="Copy TX hash"
                    >
                        {copied ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                            <Copy className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>

            <a
                href={`${cardanoScanBase}/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
                View on CardanoScan <ExternalLink className="w-4 h-4" />
            </a>

            <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-colors"
            >
                Close
            </button>
        </div>
    );
}
