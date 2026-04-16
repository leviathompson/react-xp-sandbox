import { useEffect, useMemo, useRef, useState } from "react";
import { useContext } from "../../../context/context";
import {
  fetchCryptoWalletState,
  unlockCryptoWallet,
  type CryptoWalletState,
} from "../../../utils/cryptoWallet";
import { subscribeToMessengerRealtime } from "../../../utils/messengerRealtime";
import {
  playWalletBuzzerSound,
  playWalletCelebrationSound,
  playWalletLockdownSound,
} from "../../../utils/sounds";
import WindowMenu from "../../WindowMenu/WindowMenu";
import styles from "./CryptoWallet.module.scss";

type AuthStage = "credentials" | "verification" | "unlocked";

const initialWalletState: CryptoWalletState = {
  remainingAttempts: 3,
  isLocked: false,
  lockedUntil: null,
  failedAttempts: 0,
  balanceUsd: 18369236.67,
  doomsdayEndsAt: null,
  isDoomsdayActive: false,
  isPermanentlyLocked: false,
};

const TARGET_BTC_BALANCE = 180.01;
const VERIFICATION_PIN = "9524";
const VERIFICATION_DESTINATION = "g*****@hotmail.com";

const recentTransactions = [
  {
    id: "tx-1",
    label: "Coinbase Generation",
    amount: "+ 50.00000000 BTC",
    status: "Confirmed",
  },
  {
    id: "tx-2",
    label: "Cold Storage Transfer",
    amount: "+ 1250.00000000 BTC",
    status: "Confirmed",
  },
  {
    id: "tx-3",
    label: "Mt. Gox Test Withdrawal",
    amount: "- 4.25000000 BTC",
    status: "Pending",
  },
];

const confettiPieces = Array.from({ length: 30 }, (_, index) => ({
  id: index,
  left: `${(index * 17) % 100}%`,
  delay: `${(index % 8) * 0.08}s`,
  duration: `${3.1 + (index % 5) * 0.22}s`,
  color: ["#f5bd2f", "#7fe565", "#67b7ff", "#f06ea8", "#ffffff"][index % 5],
  size: `${0.8 + (index % 4) * 0.18}rem`,
}));

const lockBars = Array.from({ length: 12 }, (_, index) => ({
  id: index,
  left: `${index * 8.6}%`,
  delay: `${index * 0.06}s`,
}));

const formatCurrency = (amount: number) =>
  amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatLockTime = (lockedUntil: string | null, now: number) => {
  if (!lockedUntil) return null;

  const remainingMs = new Date(lockedUntil).getTime() - now;
  if (remainingMs <= 0) return "00:00";

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const formatDoomsdayTime = (doomsdayEndsAt: string | null, now: number) => {
  if (!doomsdayEndsAt) return null;

  const remainingMs = new Date(doomsdayEndsAt).getTime() - now;
  if (remainingMs <= 0) return "00:00";

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const CryptoWallet = () => {
  const { username } = useContext();
  const [walletState, setWalletState] =
    useState<CryptoWalletState>(initialWalletState);
  const [authStage, setAuthStage] = useState<AuthStage>("credentials");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    "Authenticate to unlock funds.",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayBalance, setDisplayBalance] = useState(0);
  const [celebrationTick, setCelebrationTick] = useState(0);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [isErrorBuzzing, setIsErrorBuzzing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const hadPermanentLockRef = useRef(false);

  useEffect(() => {
    let isCancelled = false;

    const loadState = async () => {
      try {
        const state = await fetchCryptoWalletState();
        if (!isCancelled) setWalletState(state);
      } catch (error) {
        if (!isCancelled) {
          setStatusMessage(
            error instanceof Error
              ? error.message
              : "Unable to load wallet state.",
          );
        }
      }
    };

    void loadState();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const normalizedUser = username.trim();
    if (!normalizedUser) return;

    return subscribeToMessengerRealtime(normalizedUser, (event) => {
      if (event.type !== "crypto_wallet_state") return;
      setWalletState(event.payload.state);

      if (event.payload.state.isPermanentlyLocked) {
        setAuthStage("credentials");
        setDisplayBalance(0);
        setVerificationCode("");
        setStatusMessage("DOOMSDAY TRIGGERED. Coin Vault permanently sealed.");
        return;
      }

      if (event.payload.state.isLocked) {
        setAuthStage("credentials");
        setDisplayBalance(0);
        setVerificationCode("");
        setStatusMessage(
          "Wallet locked due to repeated failures. Shared cooldown active.",
        );
        return;
      }

      if (event.payload.state.isDoomsdayActive) {
        setStatusMessage(
          "Doomsday countdown active. Vault will seal permanently when the timer expires.",
        );
      }
    });
  }, [username]);

  useEffect(() => {
    if (!walletState.lockedUntil || walletState.isPermanentlyLocked) return;

    const unlockTime = walletState.lockedUntil
      ? new Date(walletState.lockedUntil).getTime()
      : 0;
    if (unlockTime > now) return;

    setWalletState((current) => ({
      ...current,
      isLocked: false,
      lockedUntil: null,
      remainingAttempts: 3,
      failedAttempts: 0,
    }));
    setStatusMessage(
      "Cooldown elapsed. Attempts restored once the next state sync arrives.",
    );
  }, [now, walletState.isLocked, walletState.lockedUntil]);

  useEffect(() => {
    if (!isCelebrating) return;

    const timeoutId = window.setTimeout(() => setIsCelebrating(false), 4200);
    return () => window.clearTimeout(timeoutId);
  }, [isCelebrating]);

  useEffect(() => {
    if (authStage !== "unlocked") {
      setDisplayBalance(0);
      return;
    }

    let animationFrame = 0;
    const animationStart = performance.now();
    const animationDuration = 1900;
    const targetBalance = walletState.balanceUsd;

    const animate = (timestamp: number) => {
      const progress = Math.min(
        (timestamp - animationStart) / animationDuration,
        1,
      );
      const eased = 1 - (1 - progress) ** 3;
      setDisplayBalance(targetBalance * eased);

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(animate);
      } else {
        setDisplayBalance(targetBalance);
      }
    };

    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [authStage, walletState.balanceUsd, celebrationTick]);

  useEffect(() => {
    if (authStage === "unlocked") return;
    if (walletState.isPermanentlyLocked) {
      setStatusMessage("DOOMSDAY TRIGGERED. Coin Vault permanently sealed.");
      return;
    }
    if (walletState.isDoomsdayActive) {
      setStatusMessage(
        "Doomsday countdown active. Vault will seal permanently when the timer expires.",
      );
    }
  }, [
    authStage,
    walletState.isDoomsdayActive,
    walletState.isPermanentlyLocked,
  ]);

  useEffect(() => {
    if (walletState.isPermanentlyLocked && !hadPermanentLockRef.current) {
      playWalletLockdownSound();
    }

    hadPermanentLockRef.current = walletState.isPermanentlyLocked;
  }, [walletState.isPermanentlyLocked]);

  const countdown = useMemo(
    () => formatLockTime(walletState.lockedUntil, now),
    [walletState.lockedUntil, now],
  );
  const doomsdayCountdown = useMemo(
    () => formatDoomsdayTime(walletState.doomsdayEndsAt, now),
    [walletState.doomsdayEndsAt, now],
  );
  const displayBtc =
    authStage === "unlocked" && walletState.balanceUsd > 0
      ? TARGET_BTC_BALANCE * (displayBalance / walletState.balanceUsd)
      : 0;

  const triggerFailureFeedback = (message: string) => {
    setAuthStage((current) => (current === "unlocked" ? current : current));
    setIsErrorBuzzing(true);
    window.setTimeout(() => setIsErrorBuzzing(false), 450);
    playWalletBuzzerSound();
    setStatusMessage(message);
  };

  const onCredentialSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (isSubmitting || walletState.isLocked) return;

    setIsSubmitting(true);
    setStatusMessage("Verifying wallet credentials...");

    try {
      const result = await unlockCryptoWallet(formUsername, formPassword);
      setWalletState(result.state);

      if (result.success) {
        setAuthStage("verification");
        setFormPassword("");
        setVerificationCode("");
        setStatusMessage(
          `A 4-digit verification code has been sent to ${VERIFICATION_DESTINATION}.`,
        );
        return;
      }

      setAuthStage("credentials");
      setDisplayBalance(0);
      triggerFailureFeedback(result.error || "Invalid wallet credentials.");
      setFormPassword("");
    } catch (error) {
      setAuthStage("credentials");
      setDisplayBalance(0);
      setStatusMessage(
        error instanceof Error ? error.message : "Wallet request failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const onVerificationSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (walletState.isLocked || isSubmitting) return;

    if (verificationCode.trim() !== VERIFICATION_PIN) {
      triggerFailureFeedback(
        "Incorrect verification code. Check the Hotmail inbox and try again.",
      );
      return;
    }

    setAuthStage("unlocked");
    setCelebrationTick((value) => value + 1);
    setIsCelebrating(true);
    playWalletCelebrationSound();
    if (navigator.vibrate) navigator.vibrate([120, 50, 140, 50, 200, 70, 260]);
    setStatusMessage(
      `Access granted. Vault value: ${formatCurrency(walletState.balanceUsd)}.`,
    );
    setVerificationCode("");
  };

  return (
    <div
      className={styles.wallet}
      data-celebrating={isCelebrating}
      data-error={isErrorBuzzing}
      data-permalocked={walletState.isPermanentlyLocked}
    >
      {isCelebrating && (
        <div className={styles.confettiLayer} aria-hidden="true">
          {confettiPieces.map((piece) => (
            <span
              key={`${celebrationTick}-${piece.id}`}
              className={styles.confettiPiece}
              style={{
                left: piece.left,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
                background: piece.color,
                width: piece.size,
                height: `calc(${piece.size} * 0.55)`,
              }}
            />
          ))}
        </div>
      )}
      {walletState.isPermanentlyLocked && (
        <div className={styles.lockdownOverlay} aria-hidden="true">
          <div className={styles.lockdownGlow} />
          <div className={styles.lockdownBars}>
            {lockBars.map((bar) => (
              <span
                key={bar.id}
                className={styles.lockdownBar}
                style={{ left: bar.left, animationDelay: bar.delay }}
              />
            ))}
          </div>
          <div className={styles.lockdownCenterpiece}>
            <div className={styles.holoPadlock}>
              <span className={styles.holoShackle} />
              <span className={styles.holoBody}>
                <span className={styles.holoKeyhole} />
              </span>
            </div>
            <strong>PERMA-LOCK ENGAGED</strong>
            <p>Coin Vault permanently sealed.</p>
          </div>
        </div>
      )}
      <div className={styles.menuBar}>
        <WindowMenu menuItems={["File", "Settings", "Transactions", "Help"]} />
      </div>
      <div className={styles.wallet}>
        <div className={styles.headerPanel}>
          <div>
            <p className={styles.kicker}>Bitcoin Wallet 0.1 beta</p>
            <h1>Coin Vault</h1>
            <p className={styles.subtle}>
              Status shared across every desktop session
            </p>
          </div>
          <div className={styles.coinBadge} aria-hidden="true">
            <img src="/icon__bitcoin.png" alt="" />
          </div>
        </div>

        {(walletState.isDoomsdayActive || walletState.isPermanentlyLocked) && (
          <div
            className={styles.doomsdayBar}
            data-active={walletState.isDoomsdayActive}
            data-expired={walletState.isPermanentlyLocked}
          >
            <span>Doomsday Timer</span>
            <strong>
              {walletState.isPermanentlyLocked
                ? "EXPIRED"
                : doomsdayCountdown || "00:00"}
            </strong>
            <small>
              {walletState.isPermanentlyLocked
                ? "Coin Vault permanently sealed"
                : "Countdown shared across all users"}
            </small>
          </div>
        )}

        <div className={styles.dashboard}>
          <section className={styles.balanceCard}>
            <span>Wallet Value</span>
            <p className={styles.btcValue}>
              {authStage === "unlocked"
                ? `${displayBtc.toFixed(2)} BTC`
                : "•••••• BTC"}
            </p>
            <strong className={styles.balanceValue}>
              {authStage === "unlocked"
                ? formatCurrency(displayBalance)
                : "$••••••••••••"}
            </strong>
            <small>
              {authStage === "unlocked"
                ? "Access token accepted"
                : authStage === "verification"
                  ? "Pending 2FA verification"
                  : "Credentials required"}
            </small>
          </section>

          <section className={styles.statusCard}>
            <div className={styles.statusRow}>
              <span>Network</span>
              <strong className={styles.online}>ONLINE</strong>
            </div>
            <div className={styles.statusRow}>
              <span>Attempts Left</span>
              <div className={styles.attemptLights}>
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className={styles.attemptLight}
                    data-active={index < walletState.remainingAttempts}
                  />
                ))}
              </div>
            </div>
            <div className={styles.statusRow}>
              <span>Lockout</span>
              <strong>
                {walletState.isPermanentlyLocked
                  ? "PERMA-LOCK"
                  : walletState.lockedUntil
                    ? countdown || "00:00"
                    : authStage === "verification"
                      ? "2FA"
                      : "Ready"}
              </strong>
            </div>
            {(walletState.isDoomsdayActive ||
              walletState.isPermanentlyLocked) && (
              <div className={styles.statusRow}>
                <span>Doomsday</span>
                <strong>
                  {walletState.isPermanentlyLocked
                    ? "EXPIRED"
                    : doomsdayCountdown || "00:00"}
                </strong>
              </div>
            )}
          </section>
        </div>

        <div className={styles.contentGrid}>
          <section className={styles.authPanel} data-error={isErrorBuzzing}>
            <h2>
              {authStage === "verification"
                ? "Two-Factor Verification"
                : "Operator Authentication"}
            </h2>

            {authStage === "verification" ? (
              <form onSubmit={onVerificationSubmit} className={styles.form}>
                <p className={styles.helperText}>
                  A 4-digit verification code has been sent to{" "}
                  {VERIFICATION_DESTINATION}.
                </p>
                <label>
                  <span>Verification PIN</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={verificationCode}
                    onChange={(event) =>
                      setVerificationCode(
                        event.target.value.replace(/\D/g, "").slice(0, 4),
                      )
                    }
                    autoComplete="off"
                    disabled={walletState.isLocked}
                  />
                </label>
                <button type="submit" disabled={walletState.isLocked}>
                  Verify Code
                </button>
              </form>
            ) : (
              <form onSubmit={onCredentialSubmit} className={styles.form}>
                <label>
                  <span>Username</span>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(event) => setFormUsername(event.target.value)}
                    autoComplete="off"
                    disabled={walletState.isLocked || isSubmitting}
                  />
                </label>
                <label>
                  <span>Password</span>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(event) => setFormPassword(event.target.value)}
                    autoComplete="off"
                    disabled={walletState.isLocked || isSubmitting}
                  />
                </label>
                <button
                  type="submit"
                  disabled={walletState.isLocked || isSubmitting}
                >
                  {isSubmitting ? "Checking..." : "Unlock Funds"}
                </button>
              </form>
            )}

            <p className={styles.statusMessage}>{statusMessage}</p>
            <p className={styles.warning}>
              Three failed password attempts triggers a shared five-minute
              lockout for every user.
              {walletState.isDoomsdayActive &&
                " Global doomsday countdown in progress."}
              {walletState.isPermanentlyLocked &&
                " Permanent vault lockdown active."}
            </p>
          </section>

          <section className={styles.transactionsPanel}>
            <div className={styles.transactionsHeader}>
              <h2>Recent Transactions</h2>
              <span>
                {authStage === "unlocked"
                  ? "Read only"
                  : authStage === "verification"
                    ? "Awaiting PIN"
                    : "Locked"}
              </span>
            </div>
            <div className={styles.transactionsList}>
              {recentTransactions.map((transaction) => (
                <article
                  key={transaction.id}
                  className={styles.transactionRow}
                  data-locked={authStage !== "unlocked"}
                >
                  <div>
                    <strong>{transaction.label}</strong>
                    <small>{transaction.status}</small>
                  </div>
                  <span>
                    {authStage === "unlocked" ? transaction.amount : "••••••••"}
                  </span>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CryptoWallet;
