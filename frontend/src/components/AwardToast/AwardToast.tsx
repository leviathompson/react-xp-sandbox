import { useEffect, useRef, useState } from "react";
import { usePoints } from "../../context/points";
import { playAwardSound } from "../../utils/sounds";
import styles from "./AwardToast.module.scss";
import type { PointsAward } from "../../context/points";
import type { PointRule } from "../../data/pointRules";

type ActiveAward = { award: PointsAward; rule: PointRule | undefined };

export const AwardToast = () => {
    const { recentAwards, rules } = usePoints();
    const [active, setActive] = useState<ActiveAward | null>(null);
    const seenCountRef = useRef(recentAwards.length);

    useEffect(() => {
        if (recentAwards.length <= seenCountRef.current) return;
        seenCountRef.current = recentAwards.length;

        const award = recentAwards[recentAwards.length - 1];
        const rule  = rules.find((r: PointRule) => r.id === award.ruleId);

        playAwardSound(award.points);
        setActive({ award, rule });
    }, [recentAwards, rules]);

    if (!active) return null;

    return (
        <div className={styles.overlay}>
            <div key={active.award.id} className={styles.window}>
                <div className={styles.chrome}>
                    <div className={styles.titleBar}>
                        <div className={styles.titleLeft}>
                            <img src="/favicon.png" width="14" height="14" />
                            <span>Achievement Unlocked</span>
                        </div>
                        <button className={styles.closeBtn}>✕</button>
                    </div>
                    <div className={styles.content}>
                        <p className={styles.ruleLabel}>{active.rule?.label ?? active.award.ruleId}</p>
                        <p className={styles.points}>+{active.award.points}</p>
                        <div className={styles.actions}>
                            <button className={styles.okBtn}>OK</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
